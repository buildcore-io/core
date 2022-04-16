import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();
db.collection('collection').get().then(async (snapshot) => {
  for (const col of snapshot.docs) {
    db.collection('nft').where('collection', '==', col.data().uid).get().then(async (snapshot2) => {
      let i = 0;
      let position = 0;
      for (const nft of snapshot2.docs) {
        i++;
        console.log(col.data().name, '\t', nft.data().uid, '\t',  nft.data().position, '\t', position);
        db.collection('nft').doc(nft.data().uid).update({
          position: position
        });

        if (i > 500) {
          // Wait for few seconds every 500 records.
          await new Promise(resolve => setTimeout(resolve, 3000));
          i = 0;
        }

        position++;
      }
    });
  }
});

