import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { COL } from '../interfaces/models/base';
import serviceAccount from './serviceAccountKey.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();
const record = COL.SPACE;
db.collection(record).get().then((snapshot) => {
  snapshot.docs.forEach((d) => {
    // const output: any = keywords(d.data());
    // db.collection(record).doc(output.uid).update({
    //   keywords: output.keywords
    // });
  });
});
