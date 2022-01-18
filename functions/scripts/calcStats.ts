import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { COL } from '../interfaces/models/base';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();
const recs = [COL.MEMBER, COL.SPACE, COL.AWARD, COL.PROPOSAL, COL.TRANSACTION, COL.MILESTONE];
recs.forEach((r) => {
  db.collection(r).get().then((snapshot) => {
    console.log('Total ' + r + ': ', snapshot.size);
  });
});
