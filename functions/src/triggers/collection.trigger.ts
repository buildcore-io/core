import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { Collection } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import { medium } from '../scale.settings';

// Listen for changes in all documents in the 'users' collection
export const collectionWrite: functions.CloudFunction<Change<DocumentSnapshot>> = functions.runWith({
  timeoutSeconds: 300,
  minInstances: medium
}).firestore.document(COL.COLLECTION + '/{collectionId}').onWrite(async(change) => {
  const newValue: Collection = <Collection>change.after.data();
  const previousValue: Collection = <Collection>change.before.data();
  if ((newValue.approved !== previousValue.approved) || (newValue.rejected !== previousValue.rejected)) {
    const data = await admin.firestore().collection(COL.NFT).where('collection', '==', newValue.uid).get();
    for (const nft of data.docs) {
      // Run update.
      await admin.firestore().runTransaction(async(transaction) => {
        // NFT latest.
        const refSource = admin.firestore().collection(COL.NFT).doc(nft.data().uid);
        const sfDoc = await transaction.get(refSource);
        if (sfDoc.data()) {
          // Collection latest.
          const refSourceColl = admin.firestore().collection(COL.COLLECTION).doc(sfDoc.data()?.collection);
          const sfDocColl = await transaction.get(refSourceColl);

          // Update.
          transaction.update(refSource, {
            approved: sfDocColl.data()?.approved,
            rejected: sfDocColl.data()?.rejected
          });
        }
      });
    }
  }
});
