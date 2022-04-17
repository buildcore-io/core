import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { DEF_WALLET_PAY_IN_PROGRESS, MAX_WALLET_RETRY } from '../../interfaces/config';
import { Transaction, TransactionType, WalletResult } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import { Nft } from '../../interfaces/models/nft';
import { superPump } from '../scale.settings';
import { MnemonicService } from "../services/wallet/mnemonic";
import { WalletService } from "../services/wallet/wallet";
import { serverTime } from "../utils/dateTime.utils";

// Listen for changes in all documents in the 'users' collection
export const transactionWrite: functions.CloudFunction<Change<DocumentSnapshot>> = functions.runWith({
  timeoutSeconds: 540,
  minInstances: superPump,
  memory: "512MB",
}).firestore.document(COL.TRANSACTION + '/{tranId}').onWrite(async (change) => {
  const newValue: Transaction = <Transaction>change.after.data();
  const WALLET_PAY_IN_PROGRESS = DEF_WALLET_PAY_IN_PROGRESS + Date.now();
  if (!newValue || (newValue.type !== TransactionType.CREDIT && newValue.type !== TransactionType.BILL_PAYMENT)) {
    return;
  }

  // Let's wrap this into a transaction.
  await admin.firestore().runTransaction(async (transaction) => {
    const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(newValue.uid);
    const sfDoc: any = await transaction.get(refSource);
    if (!sfDoc.data()) {
      return;
    }

    // Data object.
    const tranData: Transaction = sfDoc.data();

    if (
        !(tranData.payload.walletReference?.chainReference && tranData.payload.walletReference?.chainReference.startsWith(DEF_WALLET_PAY_IN_PROGRESS)) &&
        // Either not on chain yet or there was an error.
        (!tranData.payload.walletReference?.chainReference || tranData.payload.walletReference.error) &&
        // Not payment yet or at least one count happen to avoid loop
        (!tranData.payload.walletReference || (tranData.payload.walletReference.count > 0 && tranData.payload.walletReference.count <= MAX_WALLET_RETRY))
      ) {
      const walletResponse: WalletResult = tranData.payload.walletReference || {
        createdOn: serverTime(),
        processedOn: serverTime(),
        confirmed: false,
        chainReferences: [],
        count: 0
      };

      // Reset defaults.
      walletResponse.error = null;
      walletResponse.chainReference = WALLET_PAY_IN_PROGRESS;

      // Set wallet reference.
      walletResponse.count = walletResponse.count + 1;
      walletResponse.processedOn = serverTime();
      tranData.payload.walletReference = walletResponse;
      transaction.update(refSource, tranData);
    } else {
      console.log('Nothing to process.');
    }
  });

  // Trigger wallet
  const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(newValue.uid);
  const sfDoc: any = await refSource.get();
  const tranData: Transaction = sfDoc.data();

  // If process is required.
  if (tranData.payload.walletReference.chainReference !== WALLET_PAY_IN_PROGRESS) {
    return;
  }

  // Delay because it's retry --- this is no longer required.
  // if (tranData.payload.walletReference.count > 1) {
  //   await new Promise(resolve => setTimeout(resolve, (DEFAULT_TRANSACTION_DELAY)));
  // } else

  if (tranData.payload.delay > 0) { // Standard Delay required.
    await new Promise(resolve => setTimeout(resolve, tranData.payload.delay));
  }

  // Prepare NFT details.
  const details: any = {};
  details.tranId = tranData.uid;
  details.network = (functions.config()?.environment?.type === 'prod') ? 'soon' : 'wen';
  if (tranData.type === TransactionType.BILL_PAYMENT) {
    details.payment = true;

    // Once space can own NFT this will be expanded.
    if (tranData.member) {
      details.previousOwner = tranData.payload.previusOwner;
      details.previousOnwerEntity = tranData.payload.previusOwnerEntity;
      details.owner = tranData.member;
      details.ownerEntity = 'member';
    }
    if (tranData.payload.royalty) {
      details.royalty = tranData.payload.royalty;
    }
    if (tranData.payload.collection) {
      details.collection = tranData.payload.collection;
    }
    if (tranData.payload.nft) {
      details.nft = tranData.payload.nft;

      // Get NFT details.
      const refNft: admin.firestore.DocumentReference = admin.firestore().collection(COL.NFT).doc(tranData.payload.nft);
      const docNftData: Nft = <Nft>(await refNft.get()).data();
      if (docNftData && docNftData.ipfsMedia) {
        details.ipfsMedia = docNftData.ipfsMedia;
      }
      if (docNftData && docNftData.ipfsMetadata) {
        details.ipfsMetadata = docNftData.ipfsMetadata;
      }
    }
  }

  if (tranData.type === TransactionType.CREDIT) {
    details.refund = true;
    if (tranData.member) {
      details.member = tranData.member;
    } else if (tranData.space) {
      details.space = tranData.space;
    }
  }

  // Submit payment.
  const walletReference: WalletResult = <WalletResult>{};
  try {
    const walletService: WalletService = new WalletService();
    walletReference.chainReference = await walletService.sendFromGenesis(
      await walletService.getIotaAddressDetails(await MnemonicService.get(tranData.payload.sourceAddress)),
      tranData.payload.targetAddress,
      tranData.payload.amount,
      JSON.stringify(details)
    );
  } catch (e: any) {
    walletReference.error = e.toString();
  }

  // Update transaction with payment info.
  await admin.firestore().runTransaction(async (transaction) => {
    const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(newValue.uid);
    const sfDoc: any = await transaction.get(refSource);
    if (!sfDoc.data()) {
      return;
    }

    const tranDataLatest: Transaction = sfDoc.data();

    // Somehow other transaction have already processed it.
    if (tranDataLatest.payload.walletReference.chainReference !== WALLET_PAY_IN_PROGRESS) {
      console.error('Payment was processed twice: ' + newValue.uid);
      tranDataLatest.payload.walletReference.chainReferences.push(tranDataLatest.payload.walletReference.chainReference);
    }

    if (!walletReference.error) {
      tranDataLatest.payload.walletReference.chainReference = walletReference.chainReference;
    } else {
      tranDataLatest.payload.walletReference.chainReference = null;
      tranDataLatest.payload.walletReference.error = walletReference.error;
    }

    tranDataLatest.payload.walletReference.processedOn = serverTime();
    transaction.update(refSource, tranDataLatest);
  });

  return;
});
