import { COL } from '@build5/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();
const record = COL.MEMBER;
db.collection(record)
  .get()
  .then((snapshot) => {
    console.log(snapshot.size);
    // snapshot.docs.forEach(async (d) => {
    //   // const participant = await db.collection(record).doc(d.data().uid).collection(SUB_COL.MEMBERS).get();
    //   //   for (const part of participant.docs) {
    //   //     console.log(d.data().uid, 'no issued', participant.size, 'part', part.data().uid, 'value', part.data().voted);
    //   //     // if (!part.data().voted) {
    //   //     //   try {
    //   //     //     await db.collection(record).doc(d.data().uid).collection(SUB_COL.MEMBERS).doc(part.data().uid).update({
    //   //     //       voted: false
    //   //     //     });
    //   //     //   } catch(e) {
    //   //     //     console.error(e);
    //   //     //   }
    //   //     // }
    //   //     // console.log(d.data().uid, 'par: ', part.data().uid);
    //   //     // await db.collection(record).doc(d.data().uid).collection(SUB_COL.PARTICIPANTS).doc(part.data().uid).delete();
    //   //   }
    //   console.log(d.data().name.replace('WEN-TEST: ', ''));
    //   db.collection(record).doc(d.data().uid).update({
    //     name: d.data().name.replace('WEN-TEST: ', '')
    //   });
    // });
  });
