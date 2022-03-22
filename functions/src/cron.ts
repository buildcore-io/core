import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { COL, SUB_COL } from '../../functions/interfaces/models/base';
import { DEFAULT_TRANSACTION_DELAY, MAX_WALLET_RETRY } from '../interfaces/config';
import { Collection, TransactionType } from '../interfaces/models';
import { Nft } from '../interfaces/models/nft';
import { IpfsService, IpfsSuccessResult } from './services/ipfs/ipfs.service';
import { ProcessingService } from './services/payment/payment-processing';

export const markAwardsAsComplete: functions.CloudFunction<any> = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
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

export const reTryWallet: functions.CloudFunction<any> = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.TRANSACTION)
                    .where('payload.walletReference.confirmed', '==', false)
                    .where('payload.walletReference.count', '<', MAX_WALLET_RETRY).get();
  if (qry.size > 0) {
    for (const t of qry.docs) {
      // We ignore while there are errors.
      if (t.data().payload.walletReference.chainReference) {
        // If processed on does not exists something went wrong and try again.
        const readyToRun: dayjs.Dayjs = t.data().payload.walletReference.processedOn ? dayjs(t.data().payload.walletReference.processedOn.toDate()).add(DEFAULT_TRANSACTION_DELAY, 'ms') : dayjs().subtract(1, 's');
        // This is one is not ready yet.
        if (readyToRun.isAfter(dayjs())) {
          continue;
        }

        // Does it exists in sub-collection?
        const ref: any = await admin.firestore().collectionGroup(SUB_COL.TRANSACTIONS).where('messageId', '==', t.data().payload.walletReference.chainReference).get();
        const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(t.data().uid);
        await admin.firestore().runTransaction(async (transaction) => {
          const sfDoc: any = await transaction.get(refSource);
          if (sfDoc.data()) {
            const data: any = sfDoc.data();
            if (ref.size > 0) {
              data.payload.walletReference.confirmed = true;
            } else {
              // Save old and retry.
              data.payload.walletReference.chainReferences = data.payload.walletReference.chainReferences || [];
              data.payload.walletReference.chainReferences.push(data.payload.walletReference.chainReference);
              data.payload.walletReference.chainReference = null;
            }

            transaction.update(refSource, data);
          }
        });
      }
    }
  }

  // Finished.
  return null;
});

export const voidExpiredOrders: functions.CloudFunction<any> = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.TRANSACTION)
                    .where('type', '==', TransactionType.ORDER)
                    .where('payload.void', '==', false)
                    .where('payload.reconciled', '==', false)
                    .where('payload.expiresOn', '<=', dayjs().toDate()).get();

  if (qry.size > 0) {
    for (const t of qry.docs) {
        await admin.firestore().runTransaction(async (transaction) => {
          const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(t.data().uid);
          const sfDoc: any = await transaction.get(refSource);
          const service: ProcessingService = new ProcessingService(transaction);
          await service.markAsFinalized(sfDoc.data());

          // This will trigger all update/set.
          service.submit();
        });
    }
  }

  // Finished.
  return null;
});

export const hidePlaceholderAfterSoldOut: functions.CloudFunction<any> = functions.pubsub.schedule('every 5 minutes').onRun(async () => {
  const qry: any = await admin.firestore().collection(COL.NFT)
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
export const ipfsForNft: functions.CloudFunction<any> = functions.runWith({ timeoutSeconds: 540, memory: '512MB' }).pubsub.schedule('every 10 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.NFT).where('ipfsMedia', '==', null).limit(1000).get();;
  if (qry.size > 0) {
    for (const doc of qry.docs) {
      console.log('Processing NFT: ', doc.data().uid, ', media: ', doc.data().media, doc.data().ipfsRetries);
      if (doc.data().media && (doc.data().ipfsRetries || 0) <= MAX_UPLOAD_RETRY) {
        const refCollection: any = admin.firestore().collection(COL.COLLECTION).doc(doc.data().collection);
        const docCollection: any = await refCollection.get();

        const ipfs: IpfsService = new IpfsService();
        console.log('Init upload...');
        const obj: IpfsSuccessResult|undefined = await ipfs.fileUpload(doc.data().media, <Nft>doc.data(), <Collection>docCollection.data());
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
