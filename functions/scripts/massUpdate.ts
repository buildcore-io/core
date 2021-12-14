import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { COL, SUB_COL } from '../interfaces/models/base';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();
const record = COL.PROPOSAL;
db.collection(record).get().then((snapshot) => {
  snapshot.docs.forEach(async (d) => {
    const participant = await db.collection(record).doc(d.data().uid).collection(SUB_COL.MEMBERS).get();
      for (const part of participant.docs) {
        console.log(d.data().uid, 'no issued', participant.size, 'part', part.data().uid, 'value', part.data().voted);
        // if (!part.data().voted) {
        //   try {
        //     await db.collection(record).doc(d.data().uid).collection(SUB_COL.MEMBERS).doc(part.data().uid).update({
        //       voted: false
        //     });
        //   } catch(e) {
        //     console.error(e);
        //   }
        // }
        // console.log(d.data().uid, 'par: ', part.data().uid);
        // await db.collection(record).doc(d.data().uid).collection(SUB_COL.PARTICIPANTS).doc(part.data().uid).delete();
      }

      // db.collection(record).doc(d.data().uid).update({
      //   approved: false,
      //   rejected: false
      // });
  });
});
