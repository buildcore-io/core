import { DEF_WALLET_PAY_IN_PROGRESS, SUB_COL } from '@build5/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();
db.collection('transaction')
  .where('payload.walletReference.chainReference', '==', null)
  .where('payload.walletReference.error', '==', 'Error: You must specify some inputs')
  .get()
  .then(async (ss) => {
    for (const t of ss.docs) {
      for (const m of t.data().payload.walletReference.chainReferences || []) {
        if (m && !m.startsWith(DEF_WALLET_PAY_IN_PROGRESS)) {
          await db
            .collectionGroup(SUB_COL.TRANSACTIONS)
            .where('messageId', '==', m)
            .get()
            .then(async (sss) => {
              if (sss.size >= 1) {
                console.log(t.data().uid, t.data().payload.nft, m);

                const tran: any = t.data();
                tran.payload.walletReference.chainReference = m;
                tran.payload.walletReference.error = null;
                await db.collection('transaction').doc(t.data().uid).update(tran);
              }
            });
        }
      }
    }
  });
