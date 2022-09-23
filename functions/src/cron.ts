import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { COL } from '../../functions/interfaces/models/base';
import { Collection, Token, TransactionOrder, TransactionType } from '../interfaces/models';
import { Nft } from '../interfaces/models/nft';
import admin from './admin.config';
import { finalizeAllNftAuctions } from './cron/nft.cron';
import { cancelExpiredSale, tokenCoolDownOver } from './cron/token.cron';
import { retryWallet } from './cron/wallet.cron';
import { IpfsService, IpfsSuccessResult } from './services/ipfs/ipfs.service';
import { ProcessingService } from './services/payment/payment-processing';
import { isEmulatorEnv } from './utils/config.utils';

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

const retryWalletCron = functions.pubsub.schedule('every 2 minutes').onRun(retryWallet);

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

/* TODO MUST BE REWORKED */
const MAX_UPLOAD_RETRY = 3;
const ipfsForNft = functions.runWith({ timeoutSeconds: 540, memory: '2GB' }).pubsub.schedule('every 10 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.NFT).where('ipfsMedia', '==', null).where('rejected', '!=', true).limit(1000).get();;
  if (qry.size > 0) {
    for (const doc of qry.docs) {
      console.log('Processing NFT: ', doc.data().uid, ', media: ', doc.data().media, doc.data().ipfsRetries);
      if (doc.data().media && (doc.data().ipfsRetries || 0) <= MAX_UPLOAD_RETRY) {
        const refCollection = admin.firestore().collection(COL.COLLECTION).doc(doc.data().collection);
        const docCollection = await refCollection.get();

        const ipfs: IpfsService = new IpfsService();
        console.log('Init upload...');
        const obj: IpfsSuccessResult | undefined = await ipfs.fileUploadCollection(doc.data().media, <Nft>doc.data(), <Collection>docCollection.data());
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

/* TODO MUST BE REWORKED */
const ipfsForToken = functions.runWith({ timeoutSeconds: 540, memory: '2GB' }).pubsub.schedule('every 3 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.TOKEN).where('ipfsMedia', '==', null).where('rejected', '!=', true).limit(1000).get();;
  if (qry.size > 0) {
    for (const doc of qry.docs) {
      console.log('Processing Token: ', doc.data().uid, ', media: ', doc.data().media, doc.data().ipfsRetries);
      if (doc.data().icon && (doc.data().ipfsRetries || 0) <= MAX_UPLOAD_RETRY) {
        const ipfs: IpfsService = new IpfsService();
        console.log('Init upload...');
        const obj: IpfsSuccessResult | undefined = await ipfs.fileUploadToken(doc.data().icon, <Token>doc.data());
        if (obj) {
          console.log('Setting token ' + doc.data().uid, ' ', obj.image, obj.metadata);
          await admin.firestore().collection(COL.TOKEN).doc(doc.data().uid).update({
            ipfsMedia: obj.image,
            ipfsMetadata: obj.metadata
          });
        } else {
          await admin.firestore().collection(COL.TOKEN).doc(doc.data().uid).update({
            ipfsRetries: admin.firestore.FieldValue.increment(1)
          });
        }
      }
    }
  }
});

const tokenCoolDownOverCron = functions.pubsub.schedule('every 1 minutes').onRun(tokenCoolDownOver)

const cancelExpiredSaleCron = functions.pubsub.schedule('every 1 minutes').onRun(cancelExpiredSale)

export const cron = isEmulatorEnv
  ? {} : {
    retryWalletCron,
    markAwardsAsComplete,
    voidExpiredOrders,
    finalizeAuctionNft,
    ipfsForNft,
    ipfsForToken,
    hidePlaceholderAfterSoldOut,
    tokenCoolDownOverCron,
    cancelExpiredSaleCron,
  }

