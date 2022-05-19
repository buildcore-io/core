import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { COL, SUB_COL } from '../../functions/interfaces/models/base';
import { DEFAULT_TRANSACTION_RETRY, DEF_WALLET_PAY_IN_PROGRESS, EXTENDED_TRANSACTION_RETRY, MAX_WALLET_RETRY } from '../interfaces/config';
import { Collection, PaymentTransaction, Transaction, TransactionOrder, TransactionType } from '../interfaces/models';
import { Nft } from '../interfaces/models/nft';
import { TokenStatus } from '../interfaces/models/token';
import admin from './admin.config';
import { finalizeAllNftAuctions } from './cron/nft.cron';
import { IpfsService, IpfsSuccessResult } from './services/ipfs/ipfs.service';
import { ProcessingService } from './services/payment/payment-processing';
import { isEmulatorEnv } from './utils/config.utils';
import { dateToTimestamp } from './utils/dateTime.utils';
import { cancelExpiredSale } from './utils/token-buy-sell.utils';

const markAwardsAsComplete = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.AWARD)
    .where('completed', '==', false)
    .where('endDate', '<=', new Date()).get();
  if (qry.size > 0) {
    for (const t of qry.docs) {
      // Mark record as complete.
      functions.logger.info('mark-award-as-complete', "Award marked as complete.", {
        awardId: t.data().uid
      });

      await admin.firestore().collection(COL.AWARD).doc(t.data().uid).update({
        completed: true
      });
    }
  }

  // Finished.
  return null;
});

const reTryWallet = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.TRANSACTION)
    .where('payload.walletReference.confirmed', '==', false)
    .where('payload.walletReference.count', '<', MAX_WALLET_RETRY)
    .get();
  for (const t of qry.docs) {
    const walletReference = t.data().payload.walletReference
    // We ignore while there are errors.
    if (walletReference.chainReference) {
      // If processed on does not exists something went wrong and try again.
      const readyToRun = walletReference.processedOn ? dayjs(walletReference.processedOn.toDate()).add(DEFAULT_TRANSACTION_RETRY, 'ms') : dayjs().subtract(1, 's');
      const readyToReprocessedWallet = walletReference.processedOn ? dayjs(walletReference.processedOn.toDate()).add(EXTENDED_TRANSACTION_RETRY, 'ms') : dayjs().subtract(1, 's');
      // This is one is not ready yet.
      if (
        readyToRun.isAfter(dayjs()) ||
        // It can take up to 10 minutes when servers are overloaded.
        (readyToReprocessedWallet.isAfter(dayjs()) && walletReference?.chainReference.startsWith(DEF_WALLET_PAY_IN_PROGRESS))
      ) {
        continue;
      }

      // Does it exists in sub-collection?
      const ref = await admin.firestore().collectionGroup(SUB_COL.TRANSACTIONS).where('messageId', '==', walletReference.chainReference).get();
      await admin.firestore().runTransaction(async (transaction) => {
        const sfDoc = await transaction.get(t.ref);
        if (sfDoc.data()) {
          const data = <Transaction>sfDoc.data();
          const payload = <PaymentTransaction>data.payload
          if (ref.size > 0) {
            payload.walletReference.confirmed = true;
          } else {
            if (data.payload.walletReference) {
              data.payload.walletReference.error = 'Unable to find on chain. Retry.';
            }
            data.shouldRetry = true
          }
          transaction.update(t.ref, data);
        }
      });
    }
  }

});

const voidExpiredOrders = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.ORDER)
    .where('payload.void', '==', false)
    .where('payload.reconciled', '==', false)
    .where('payload.expiresOn', '<=', dayjs().toDate()).get();

  if (qry.size > 0) {
    for (const t of qry.docs) {
      await admin.firestore().runTransaction(async (transaction) => {
        const refSource = admin.firestore().collection(COL.TRANSACTION).doc(t.data().uid);
        const sfDoc = await transaction.get(refSource);
        const service: ProcessingService = new ProcessingService(transaction);
        await service.markAsVoid(<TransactionOrder>sfDoc.data());

        // This will trigger all update/set.
        service.submit();
      });
    }
  }

  // Finished.
  return null;
});

export const finalizeAuctionNft = functions.pubsub.schedule('every 1 minutes').onRun(finalizeAllNftAuctions);

const hidePlaceholderAfterSoldOut = functions.pubsub.schedule('every 5 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.NFT)
    .where('sold', '==', true)
    .where('placeholderNft', '==', true)
    .where('availableFrom', '==', null)
    .where('hidden', '==', false)
    .where('owner', '==', null).get();
  if (qry.size > 0) {
    for (const t of qry.docs) {
      if (t.data().soldOn && t.data().soldOn.toDate() && dayjs(t.data().soldOn.toDate()).isBefore(dayjs().add(24, 'hours'))) {
        await admin.firestore().collection(COL.NFT).doc(t.data().uid).update({
          hidden: true
        });
      }
    }
  }

  // Finished.
  return null;
});

const MAX_UPLOAD_RETRY = 3;
const ipfsForNft = functions.runWith({ timeoutSeconds: 540, memory: '2GB' }).pubsub.schedule('every 10 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.NFT).where('ipfsMedia', '==', null).limit(1000).get();;
  if (qry.size > 0) {
    for (const doc of qry.docs) {
      console.log('Processing NFT: ', doc.data().uid, ', media: ', doc.data().media, doc.data().ipfsRetries);
      if (doc.data().media && (doc.data().ipfsRetries || 0) <= MAX_UPLOAD_RETRY) {
        const refCollection = admin.firestore().collection(COL.COLLECTION).doc(doc.data().collection);
        const docCollection = await refCollection.get();

        const ipfs: IpfsService = new IpfsService();
        console.log('Init upload...');
        const obj: IpfsSuccessResult | undefined = await ipfs.fileUpload(doc.data().media, <Nft>doc.data(), <Collection>docCollection.data());
        if (obj) {
          console.log('Setting nft ' + doc.data().uid, ' ', obj.image, obj.metadata);
          await admin.firestore().collection(COL.NFT).doc(doc.data().uid).update({
            ipfsMedia: obj.image,
            ipfsMetadata: obj.metadata
          });
        } else {
          await admin.firestore().collection(COL.NFT).doc(doc.data().uid).update({
            ipfsRetries: admin.firestore.FieldValue.increment(1)
          });
        }
      }
    }
  }
});

const tokenCoolDownOver = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  const tokens = await admin.firestore().collection(`${COL.TOKEN}`)
    .where('status', '==', TokenStatus.AVAILABLE)
    .where('coolDownEnd', '<=', dateToTimestamp(dayjs().toDate()))
    .get();
  const promises = tokens.docs.map(doc => doc.ref.update({ status: TokenStatus.PROCESSING }));
  await Promise.allSettled(promises)
})

const cancelExpiredSaleCron = functions.pubsub.schedule('every 1 minutes').onRun(cancelExpiredSale)

export const cron = isEmulatorEnv
  ? {} : {
    reTryWallet,
    markAwardsAsComplete,
    voidExpiredOrders,
    finalizeAuctionNft,
    ipfsForNft,
    hidePlaceholderAfterSoldOut,
    tokenCoolDownOver,
    cancelExpiredSaleCron,
  }

