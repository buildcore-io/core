import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { dateToTimestamp } from '../src/utils/dateTime.utils';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();
db.collection('nft')
  .where('collection', '==', '0xc95de0524b2112a36701b9d3465e61772ae6ce8e')
  .get()
  .then(async (snapshot) => {
    for (const nft of snapshot.docs) {
      if (nft.data().availableFrom) {
        await db
          .collection('nft')
          .doc(nft.data().uid)
          .update({
            availableFrom: dateToTimestamp('Mar 7, 2022 10:00:00 PM'),
          });
      }
    }
  });
