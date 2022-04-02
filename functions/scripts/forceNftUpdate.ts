import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { NftAvailable } from '../interfaces/models/nft';
import serviceAccount from './serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();
db.collection('nft').get().then(async (snapshot) => {
  for (const nft of snapshot.docs) {
    await db.collection('nft').doc(nft.data().uid).update({
      available: NftAvailable.UNAVAILABLE,
      isOwned: false
    });
  }
});

