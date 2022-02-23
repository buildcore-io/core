import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { Change } from "firebase-functions";
import { DocumentSnapshot } from "firebase-functions/v1/firestore";
import { Collection } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';

// Listen for changes in all documents in the 'users' collection
export const collectionWrite: functions.CloudFunction<Change<DocumentSnapshot>> = functions.runWith({
  timeoutSeconds: 300,
  memory: "4GB",
}).firestore.document(COL.COLLECTION + '/{collectionId}').onWrite(async (change) => {
  const newValue: Collection = <Collection>change.after.data();
  const previousValue: Collection = <Collection>change.before.data();
  if ((newValue.approved == true && previousValue.approved === false)  || (newValue.rejected == true && previousValue.rejected === false)) {
    const data: any = await admin.firestore().collection(COL.NFT).where('collection', '==', newValue.uid).get();
    for (const nft of data.docs) {
      const refSource: any = admin.firestore().collection(COL.NFT).doc(nft.data().uid);
      await admin.firestore().runTransaction(async (transaction) => {
        const sfDoc: any = await transaction.get(refSource);
        if (sfDoc.data()) {
          // Update.
          transaction.update(refSource, {
            approved: newValue.approved,
            rejected: newValue.rejected
          });
        }
      });
    }
  }
});
