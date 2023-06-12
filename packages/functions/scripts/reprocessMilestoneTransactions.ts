import { SUB_COL } from '@build5/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();
db.collectionGroup(SUB_COL.TRANSACTIONS)
  .get()
  .then(async (ss) => {
    for (const t of ss.docs) {
      if (t.data().milestone > 2855200 && t.data().processed !== true) {
        console.log(t.data().milestone, '\t', t.data().messageId, '\t', t.id);
        // await db.collection(COL.MILESTONE).doc(t.data().milestone!.toString()).collection(SUB_COL.TRANSACTIONS).doc(t.id).update({
        //   processed: false
        // });
      }
    }
  });
