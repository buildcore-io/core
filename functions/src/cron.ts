import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { COL } from '../../functions/interfaces/models/base';
import { Collection, TransactionType, TRANSACTION_AUTO_EXPIRY_MS } from '../interfaces/models';
import { Nft } from '../interfaces/models/nft';
import { IpfsService, IpfsSuccessResult } from './services/ipfs/ipfs.service';

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

export const voidExpiredOrders: functions.CloudFunction<any> = functions.pubsub.schedule('every 1 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.TRANSACTION)
                    .where('type', '==', TransactionType.ORDER)
                    .where('payload.void', '==', false)
                    .where('payload.reconciled', '==', false)
                    .where('createdOn', '<=', dayjs().subtract(TRANSACTION_AUTO_EXPIRY_MS, 'ms').toDate()).get();

  if (qry.size > 0) {
    for (const t of qry.docs) {
        const refSource: any = admin.firestore().collection(COL.TRANSACTION).doc(t.data().uid);
        await admin.firestore().runTransaction(async (transaction) => {
          const updates: any[] = [];
          const sfDoc: any = await transaction.get(refSource);
          if (sfDoc.data()) {
            const data: any = sfDoc.data();
            data.payload.void = true;
            updates.push({
              ref: refSource,
              data: data
            });
          }

          // We need to unlock NFT.
          if (sfDoc.data().payload.nft) {
            const refNft: any = await admin.firestore().collection(COL.NFT).doc(sfDoc.data().payload.nft);
            const sfDocNft: any = await transaction.get(refNft);
            if (sfDocNft.data()) {
              updates.push({
                ref: refNft,
                data: {
                  locked: false,
                  lockedBy: null
                }
              });
            }
          }

          updates.forEach((p) => {
            transaction.update(p.ref, p.data);
          });
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
export const ipfsForNft: functions.CloudFunction<any> = functions.runWith({ timeoutSeconds: 540, memory: '256MB' }).pubsub.schedule('every 10 minutes').onRun(async () => {
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
