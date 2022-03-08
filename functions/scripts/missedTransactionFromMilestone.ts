import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import serviceAccount from './serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount)
});

const db = getFirestore();
db.collection('transaction').where('type', '==', 'ORDER').get().then(async (ss) => {
  const unprocessed: string[] = [];
  for (const t of ss.docs) {
    if (!t.data().linkedTransactions || t.data().linkedTransactions.length === 0) {
      unprocessed.push(t.data().payload.targetAddress);
    }
  }

  console.log('Unprocessed orders', unprocessed.length);

  const tangleTransactions: any = [];
  await db.collectionGroup('transactions').get().then(async (ss) => {
    for (const t of ss.docs) {
      tangleTransactions.push(t.data());
    }
  });

  console.log('Tangle Transactions: ', tangleTransactions.length);

  const ignored: any = [];
  for (const o of unprocessed) {
    const found: any = findMatch(tangleTransactions, o);
    if (found) {
      ignored.push(found);
    }

  }

  // TODO Validate balance.

  console.log('Ignored transactions: ', ignored.length);
});

function findMatch(trans: any, toAddress: string): any | undefined {
  let found: any | undefined;
  for (const [msgId, t] of <any>Object.entries(trans)) {
    const fromAddress: any = t.inputs?.[0];
    if (fromAddress && t.outputs) {
      for (const o of t.outputs) {

        // Ignore output that contains input address. Remaining balance.
        if (t.inputs.find((i: any) => {
          return o.address === i.address;
        })) {
          continue;
        }

        if (o.address === toAddress) {
          found = {
            msgId: msgId,
            from: fromAddress,
            to: o
          };
        }
      }
    }
  }

  return found;
}
