import * as functions from 'firebase-functions';
import { DEF_WALLET_PAY_IN_PROGRESS, MAX_WALLET_RETRY } from '../../interfaces/config';
import { WEN_FUNC } from '../../interfaces/functions';
import { BillPaymentTransaction, CreditPaymentTransaction, IOTATangleTransaction, PaymentTransaction, Transaction, TransactionType, WalletResult } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import { Nft } from '../../interfaces/models/nft';
import admin from '../admin.config';
import { scale } from '../scale.settings';
import { MnemonicService } from "../services/wallet/mnemonic";
import { WalletService } from "../services/wallet/wallet";
import { isEmulatorEnv, isProdEnv } from '../utils/config.utils';
import { serverTime } from "../utils/dateTime.utils";

// Listen for changes in all documents in the 'users' collection
export const transactionWrite = functions.runWith({
  timeoutSeconds: 540,
  minInstances: scale(WEN_FUNC.transactionWrite),
  memory: "512MB",
}).firestore.document(COL.TRANSACTION + '/{tranId}').onWrite(async (change) => {
  const WALLET_PAY_IN_PROGRESS = DEF_WALLET_PAY_IN_PROGRESS + Date.now();
  const prev = <Transaction | undefined>change.before.data();
  const curr = <Transaction | undefined>change.after.data();

  const isCreditOrBillPayment = (curr?.type === TransactionType.CREDIT || curr?.type === TransactionType.BILL_PAYMENT);
  const isCreate = (prev === undefined);
  const shouldRetry = (!prev?.shouldRetry && curr?.shouldRetry);

  if (isCreditOrBillPayment && !(curr?.ignoreWallet) && (isCreate || shouldRetry)) {
    await execute(curr, WALLET_PAY_IN_PROGRESS);
  }
});

const execute = async (newValue: Transaction, WALLET_PAY_IN_PROGRESS: string) => {
  // Let's wrap this into a transaction.
  const shouldProcess = await admin.firestore().runTransaction(async (transaction) => {
    const refSource = admin.firestore().collection(COL.TRANSACTION).doc(newValue.uid);
    const sfDoc = await transaction.get(refSource);
    if (!sfDoc.data()) {
      return;
    }

    // Data object.
    const tranData = <Transaction>sfDoc.data();
    const payload = <BillPaymentTransaction | CreditPaymentTransaction>tranData.payload
    if (
      !(payload.walletReference?.chainReference && payload.walletReference?.chainReference.startsWith(DEF_WALLET_PAY_IN_PROGRESS)) &&
      // Either not on chain yet or there was an error.
      (!payload.walletReference?.chainReference || payload.walletReference.error) &&
      // Not payment yet or at least one count happen to avoid loop
      (!payload.walletReference || (payload.walletReference.count > 0 && payload.walletReference.count <= MAX_WALLET_RETRY))
    ) {
      const walletResponse: WalletResult = payload.walletReference || {
        createdOn: serverTime(),
        processedOn: serverTime(),
        confirmed: false,
        chainReferences: [],
        count: 0
      };

      if (payload.walletReference?.chainReference) {
        payload.walletReference.chainReferences?.push(payload.walletReference.chainReference);
      }

      // Reset defaults.
      walletResponse.error = null;
      walletResponse.chainReference = WALLET_PAY_IN_PROGRESS;

      // Set wallet reference.
      walletResponse.count = walletResponse.count + 1;
      walletResponse.processedOn = serverTime();
      payload.walletReference = walletResponse;
      tranData.shouldRetry = false;
      transaction.update(refSource, tranData);
      return true
    } else {
      console.log('Nothing to process.');
      return false
    }
  });

  if (!shouldProcess) {
    return;
  }

  // Trigger wallet
  const refSource = admin.firestore().collection(COL.TRANSACTION).doc(newValue.uid);
  const sfDoc = await refSource.get();
  const tranData = <Transaction>sfDoc.data();

  const payload = tranData.payload

  // If process is required.
  if (payload.walletReference?.chainReference !== WALLET_PAY_IN_PROGRESS) {
    return;
  }

  if (!isEmulatorEnv && payload.delay > 0) { // Standard Delay required.
    await new Promise(resolve => setTimeout(resolve, payload.delay));
  }

  // Prepare NFT details.
  const details = <IOTATangleTransaction>{};
  details.tranId = tranData.uid;
  details.network = isProdEnv() ? 'soon' : 'wen';
  if (tranData.type === TransactionType.BILL_PAYMENT) {
    details.payment = true;

    // Once space can own NFT this will be expanded.
    if (tranData.member) {
      details.previousOwner = payload.previousOwner;
      details.previousOwnerEntity = payload.previousOwnerEntity;
      details.owner = tranData.member;
      details.ownerEntity = 'member';
    }
    if (payload.royalty) {
      details.royalty = payload.royalty;
    }
    if (payload.collection) {
      details.collection = payload.collection;
    }
    if (payload.nft) {
      details.nft = payload.nft;

      // Get NFT details.
      const refNft: admin.firestore.DocumentReference = admin.firestore().collection(COL.NFT).doc(payload.nft);
      const docNftData = <Nft>(await refNft.get()).data();
      if (docNftData && docNftData.ipfsMedia) {
        details.ipfsMedia = docNftData.ipfsMedia;
      }
      if (docNftData && docNftData.ipfsMetadata) {
        details.ipfsMetadata = docNftData.ipfsMetadata;
      }
    }
    if (payload.token) {
      details.token = payload.token;
      details.quantity = payload.quantity || 0
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
      await walletService.getIotaAddressDetails(await MnemonicService.get(payload.sourceAddress)),
      payload.targetAddress,
      payload.amount,
      JSON.stringify(details)
    );
  } catch (e) {
    walletReference.error = JSON.stringify(e);
  }

  // Update transaction with payment info.
  await admin.firestore().runTransaction(async (transaction) => {
    const refSource = admin.firestore().collection(COL.TRANSACTION).doc(newValue.uid);
    const sfDoc = await transaction.get(refSource);
    if (!sfDoc.data()) {
      return;
    }

    const tranDataLatest = <Transaction>sfDoc.data();
    const payload = <PaymentTransaction | BillPaymentTransaction | CreditPaymentTransaction>tranDataLatest.payload

    // Somehow other transaction have already processed it.
    if (payload.walletReference.chainReference !== WALLET_PAY_IN_PROGRESS) {
      console.error('Payment was processed twice: ' + newValue.uid);
      payload.walletReference.chainReference && payload.walletReference.chainReferences?.push(payload.walletReference.chainReference);
    }

    if (!walletReference.error) {
      payload.walletReference.chainReference = walletReference.chainReference;
    } else {
      payload.walletReference.chainReference = null;
      payload.walletReference.error = walletReference.error;
    }

    payload.walletReference.processedOn = serverTime();
    transaction.update(refSource, tranDataLatest);
  });

}
