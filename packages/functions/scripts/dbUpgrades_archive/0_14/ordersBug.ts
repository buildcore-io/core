import { COL, TransactionType } from '@soonaverse/interfaces';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { last } from 'lodash';
import serviceAccount from '../../serviceAccountKeyProd.json';

initializeApp({
  credential: cert(<any>serviceAccount),
});

const db = getFirestore();

const BATCH_LIMIT = 10000;

export const setStatusOnAllDocs = async (collection: COL) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastDoc: any | undefined = undefined;
  do {
    let query = db
      .collection(collection)
      .where('type', '==', TransactionType.ORDER)
      .limit(BATCH_LIMIT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    const promises = snap.docs.map((doc) => {
      if (
        doc.data().linkedTransactions?.length > 10 &&
        doc.data().createdOn.toDate() > new Date('2022-09-27')
      ) {
        console.log(
          'Tran ' +
            doc.data().createdOn.toDate() +
            ', ' +
            collection +
            ' id: ' +
            doc.data().uid +
            ', ' +
            doc.data().type +
            ', ' +
            doc.data().payload.targetAddress +
            ', ' +
            doc.data().payload.type +
            ', ' +
            doc.data().member +
            '...' +
            doc.data().linkedTransactions?.length,
        );

        // // Remove address on Member.
        // db.collection(COL.MEMBER).doc(doc.data().member).update({
        //   'validatedAddress.smr': null
        // });

        // // Delete linked transaction.
        // doc.data().linkedTransactions.forEach((l: string) => {
        //   if (l) {
        //     db.collection(COL.TRANSACTION).doc(l).delete();
        //   }
        // });

        // // Delete order!
        // db.collection(COL.TRANSACTION).doc(doc.data().uid).delete();
      }
      return;
    });
    await Promise.all(promises);
    lastDoc = last(snap.docs);
  } while (lastDoc !== undefined);
};

export const run = async () => {
  await setStatusOnAllDocs(COL.TRANSACTION);
};

run();
