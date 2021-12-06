import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { COL, SUB_COL } from '../interfaces/models/base';
import serviceAccount from './serviceAccountKey.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();
const record = COL.AWARD;
db.collection(record).get().then((snapshot) => {
  snapshot.docs.forEach(async (d) => {
    if (d.data().issued > 0) {
      console.log(d.data().uid, {
        approved: true,
        rejected: false
      });
      // db.collection(record).doc(d.data().uid).update({
      //   approved: true,
      //   rejected: false
      // });
    } else {
      console.log(d.data().uid, 'no issued');
      const participant = await db.collection(record).doc(d.data().uid).collection(SUB_COL.PARTICIPANTS).get();
      participant.docs.forEach(async (part) => {
        console.log('par: ', part.data().uid);
        // await db.collection(record).doc(d.data().uid).collection(SUB_COL.PARTICIPANTS).doc(part.data().uid).delete();
      });

      // db.collection(record).doc(d.data().uid).update({
      //   approved: true,
      //   rejected: false
      // });
    }
  });
});
