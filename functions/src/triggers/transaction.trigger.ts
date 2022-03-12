import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { DEFAULT_TRANSACTION_DELAY, MAX_WALLET_RETRY } from '../../interfaces/config';
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
  if (!newValue || (newValue.type !== TransactionType.CREDIT && newValue.type !== TransactionType.BILL_PAYMENT)) {
    return;
  }

  if (
      // Either not on chain yet or there was an error.
      (!newValue.payload.walletReference?.chainReference || newValue.payload.walletReference.error) &&
      // Not payment yet or at least one count happen to avoid loop
      (!newValue.payload.walletReference || (newValue.payload.walletReference.count > 0 && newValue.payload.walletReference.count <= MAX_WALLET_RETRY))
    ) {
    const walletService: WalletService = new WalletService();
    const walletResponse: WalletResult = newValue.payload.walletReference || {
      createdOn: serverTime(),
      processedOn: serverTime(),
      confirmed: false,
      chainReferences: [],
      count: 0
    };

    // Reset defaults.
    walletResponse.error = null;
    walletResponse.chainReference = null;

    // Delay because it's retry.
    if (walletResponse.count > 0) {
      await new Promise(resolve => setTimeout(resolve, (DEFAULT_TRANSACTION_DELAY)));
    } else if (newValue.payload.delay > 0) { // Standard Delay required.
      await new Promise(resolve => setTimeout(resolve, newValue.payload.delay));
    }

    const details: any = {};
    details.tranId = newValue.uid;
    details.network = (functions.config()?.environment?.type === 'prod') ? 'soon' : 'wen';
    if (newValue.type === TransactionType.BILL_PAYMENT) {
      details.payment = true;

      // Once space can own NFT this will be expanded.
      if (newValue.member) {
        details.previousOwner = newValue.payload.previusOwner;
        details.previousOnwerEntity = newValue.payload.previusOwnerEntity;
        details.owner = newValue.member;
        details.ownerEntity = 'member';
      }
      if (newValue.payload.royalty) {
        details.royalty = newValue.payload.royalty;
      }
      if (newValue.payload.collection) {
        details.collection = newValue.payload.collection;
      }
      if (newValue.payload.nft) {
        details.nft = newValue.payload.nft;

        // Get NFT details.
        const refNft: admin.firestore.DocumentReference = admin.firestore().collection(COL.NFT).doc(newValue.payload.nft);
        const docNftData: Nft = <Nft>(await refNft.get()).data();
        if (docNftData) {
          details.ipfs = docNftData.ipfsMetadata;
        }
      }
    }

    if (newValue.type === TransactionType.CREDIT) {
      details.refund = true;
      if (newValue.member) {
        details.member = newValue.member;
      } else if (newValue.space) {
        details.space = newValue.space;
      }
    }
    try {
      walletResponse.chainReference = await walletService.sendFromGenesis(
        await walletService.getIotaAddressDetails(await MnemonicService.get(newValue.payload.sourceAddress)),
        newValue.payload.targetAddress,
        newValue.payload.amount,

        // TODO What we want to add to tangle.
        JSON.stringify(details)
      );
    } catch (e: any) {
      walletResponse.error = e.toString();
    }

    // Set wallet reference.
    walletResponse.count = walletResponse.count + 1;
    walletResponse.processedOn = serverTime();
    newValue.payload.walletReference = walletResponse;
    return change.after.ref.set(newValue, {merge: true});
  } else {
    console.log('Nothing to process.');
    return;
  }
});
