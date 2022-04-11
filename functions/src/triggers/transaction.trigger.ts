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
  // Let's wrap this into a transaction.
  await admin.firestore().runTransaction(async (transaction) => {
    if (!newValue || (newValue.type !== TransactionType.CREDIT && newValue.type !== TransactionType.BILL_PAYMENT)) {
      return;
    }

    const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(newValue.uid);
    const sfDoc: any = await transaction.get(refSource);
    if (!sfDoc.data()) {
      return;
    }

    // Data object.
    const tranData: Transaction = sfDoc.data();

    if (
        // Either not on chain yet or there was an error.
        (!tranData.payload.walletReference?.chainReference || tranData.payload.walletReference.error) &&
        // Not payment yet or at least one count happen to avoid loop
        (!tranData.payload.walletReference || (tranData.payload.walletReference.count > 0 && tranData.payload.walletReference.count <= MAX_WALLET_RETRY))
      ) {
      const walletService: WalletService = new WalletService();
      const walletResponse: WalletResult = tranData.payload.walletReference || {
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
      } else if (tranData.payload.delay > 0) { // Standard Delay required.
        await new Promise(resolve => setTimeout(resolve, tranData.payload.delay));
      }

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
      try {
        walletResponse.chainReference = await walletService.sendFromGenesis(
          await walletService.getIotaAddressDetails(await MnemonicService.get(tranData.payload.sourceAddress)),
          tranData.payload.targetAddress,
          tranData.payload.amount,

          // TODO What we want to add to tangle.
          JSON.stringify(details)
        );
      } catch (e: any) {
        walletResponse.error = e.toString();
      }

      // Set wallet reference.
      walletResponse.count = walletResponse.count + 1;
      walletResponse.processedOn = serverTime();
      tranData.payload.walletReference = walletResponse;
      transaction.update(refSource, tranData);
    } else {
      console.log('Nothing to process.');
    }
  });

  return;
});
