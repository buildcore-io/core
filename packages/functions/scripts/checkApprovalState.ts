import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();
db.collection('collection')
  .get()
  .then(async (snapshot) => {
    for (const col of snapshot.docs) {
      db.collection('nft')
        .where('collection', '==', col.data().uid)
        .get()
        .then(async (snapshot2) => {
          let i = 0;
          for (const nft of snapshot2.docs) {
            const update: any = {};
            if (nft.data().approved !== col.data().approved) {
              // i++;
              console.log(
                nft.data().approved,
                col.data().approved,
                nft.data().uid,
                ' should be approved, collection name:',
                col.data().name,
              );
              update.approved = col.data().approved;
            }

            if (nft.data().rejected !== col.data().rejected) {
              // ii++;
              console.log(
                nft.data().rejected,
                col.data().rejected,
                nft.data().uid,
                ' should be rejected',
              );
              update.rejected = col.data().rejected;
            }

            if (Object.keys(update).length > 0) {
              i++;
              // db.collection('nft').doc(nft.data().uid).update(update);

              if (i > 500) {
                // Wait for two seconds every 500 records.
                // await new Promise(resolve => setTimeout(resolve, 3000));
                i = 0;
              }
            }
          }
        });
    }
  });
