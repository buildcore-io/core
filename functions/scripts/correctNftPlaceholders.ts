import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();
db.collection('collection').get().then(async (snapshot) => {
  for (const col of snapshot.docs) {
    db.collection('nft').where('collection', '==', col.data().uid).where('placeholderNft', '==', true).where('hidden', '==', false).get().then(async (snapshot2) => {
      let i = 0;
      for (const nft of snapshot2.docs) {
        i++;
        const left = (col.data().total - col.data().sold);
        if (left <= 0) {
          console.log(col.data().name, '\t', nft.data().uid, '\t',  (col.data().total - col.data().sold), '\t', nft.data().sold, '\t', nft.data().availableFrom);
          // db.collection('nft').doc(nft.data().uid).update({
          //     sold: true,
          //     owner: null,
          //     availableFrom: null,
          //     soldOn: serverTime(),
          //     hidden: true
          // });

          if (i > 500) {
            // Wait for few seconds every 500 records.
            await new Promise(resolve => setTimeout(resolve, 3000));
            i = 0;
          }
        }
      }
    });
  }
});

