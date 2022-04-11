import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();
db.collection('collection').where('uid', '==', '0xcbe28532602d67eec7c937c0037509d426f38223').get().then(async (snapshot) => {
  for (const col of snapshot.docs) {
    console.log('Coll', col.data().total, ' sold: ', col.data().sold);
    // const totalOwned = await db.collection('nft').where('collection', '==', col.data().uid).where('onwer', '!=', null).get();
    // console.log('total sold: ', totalOwned.size);
    const notSold = await db.collection('nft').where('collection', '==', col.data().uid).where('soldOn', '==', null).get();
    console.log('total not sold: ', notSold.size, 'should be sold: ', col.data().total - notSold.size);
  }
});

