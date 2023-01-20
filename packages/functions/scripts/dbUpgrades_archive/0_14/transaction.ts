import { COL, TransactionType } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from '../../serviceAccountKeyTest.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();

const BATCH_LIMIT = 1000;

export const setIsOrderType = async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any | undefined = undefined;
  do {
    let query = db.collection(COL.TRANSACTION).limit(BATCH_LIMIT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    const promises = snap.docs.map((doc) =>
      doc.ref.update({ isOrderType: doc.data()?.type === TransactionType.ORDER }),
    );
    await Promise.all(promises);
    lastDoc = last(snap.docs);
  } while (lastDoc !== undefined);
};

setIsOrderType();
