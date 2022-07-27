import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { WalletService } from '../src/services/wallet/wallet';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const add = ["iota1qq5sprmgxrgaj5jx0xvwxczceshmz8nzkmxns0w5kx54lc426mvngm4nl65"]

const db = getFirestore();
const wallet = WalletService.newWallet();
db.collection('_mnemonic').limit(1).get().then(async (ss) => {
  for (const t of add) {
    let balance = 0;
    try {
      balance = await wallet.getBalance(t);
    } catch (e) {
      // ignore
    }

    console.log('Balance', t, balance);
    if (balance > 0) {
      console.log('Refunding...');
      const chainReference = await wallet.send(
        await wallet.getAddressDetails(t),
        'iota1qrl8ldyshmvzdhjc88fmjpqkeqpylyhw03tu3gx7la0ftn3vuxp0c529f68',
        balance,
        JSON.stringify({ drain: true })
      );

      console.log('refunded: ', chainReference);
    }
  }
});

