import { Transaction } from '@build-5/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();
db.collection('transaction')
  .where('payload_walletReference.confirmed', '==', false)
  .where('payload_walletReference.count', '<=', 4)
  .orderBy('payload.walletReference.count', 'asc')
  .limit(10000)
  .get()
  .then(async (ss) => {
    console.log(ss.size);
    for (const t of ss.docs) {
      const tt: Transaction = <any>t.data();
      tt.shouldRetry = false;
      console.log('Retrying ' + tt.uid + '...');
      await db.collection('transaction').doc(tt.uid).update(tt);
    }
  });
