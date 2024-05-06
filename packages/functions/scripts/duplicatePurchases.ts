import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();
const nfts: any = {};
db.collection('transaction')
  .where('type', '==', 'BILL_PAYMENT')
  .where('payload_royalty', '==', false)
  .get()
  .then(async (ss) => {
    for (const t of ss.docs) {
      // console.log(t.data().uid);
      nfts[t.data().payload.nft] = nfts[t.data().payload.nft] || {
        id: t.data().payload.nft,
        trans: [],
        dates: [],
        count: 0,
      };
      nfts[t.data().payload.nft].count++;
      nfts[t.data().payload.nft].trans.push(t.data().uid);
      nfts[t.data().payload.nft].dates.push(t.data().createdOn.toDate());
    }

    console.log('nftId, count, transactions, dates');
    for (const n of <any>Object.values(nfts)) {
      if (n.count > 1) {
        console.log(n.id, ',', n.count, ',', n.trans.join(' | '), ',', n.dates.join(' | '));
      }
    }
  });
