import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { COL } from '../../functions/interfaces/models/base';
import { Collection } from '../interfaces/models';
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

const MAX_UPLOAD_RETRY = 3;
export const ipfsForNft: functions.CloudFunction<any> = functions.runWith({ timeoutSeconds: 540, memory: '4GB' }).pubsub.schedule('every 5 minutes').onRun(async () => {
  const qry = await admin.firestore().collection(COL.NFT).where('ipfsMedia', '==', null).get();;
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
