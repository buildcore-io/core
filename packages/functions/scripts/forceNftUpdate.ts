import { NftAvailable } from '@buildcore/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

let i = 0;
const db = getFirestore();
db.collection('nft')
  .get()
  .then(async (snapshot) => {
    for (const nft of snapshot.docs) {
      i++;
      console.log(i, '\t', nft.data().uid);
      const up: any = {
        available: NftAvailable.UNAVAILABLE,
        isOwned: false,
      };

      if (
        !nft.data().availablePrice &&
        nft.data().availableFrom &&
        !nft.data().owner &&
        nft.data().price
      ) {
        up.availablePrice = nft.data().price;
      }

      await db.collection('nft').doc(nft.data().uid).update(up);
    }
  });
