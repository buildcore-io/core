import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { WalletService } from '../src/services/wallet/wallet';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();
const wallet: WalletService = new WalletService();
db.collection('_mnemonic').get().then(async (ss) => {
  console.log('address,balance,createTime')
  for (const t of ss.docs) {
    let balance = 0;
    try {
      balance = await wallet.getBalance(t.id);
    } catch(e) {
      // ignore
    }
    if (balance > 0) {
      console.log(t.id + ',' + balance + ',' + t.createTime.toDate())
    }
  }
});
