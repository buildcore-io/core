import { COL, DEFAULT_NETWORK, Transaction } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from '../../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

export const rollNetwork = async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(COL.TRANSACTION).limit(1000);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();

    const promises = snap.docs.map((doc) => {
      const data = <Transaction>doc.data();
      if (data.network) {
        return undefined;
      }
      return doc.ref.update({
        network: doc.data()['targetNetwork'] || DEFAULT_NETWORK,
        sourceNetwork: FieldValue.delete(),
        targetNetwork: FieldValue.delete(),
      });
    });

    await Promise.all(promises);
    lastDoc = last(snap.docs);
  } while (lastDoc !== undefined);
};

rollNetwork();
