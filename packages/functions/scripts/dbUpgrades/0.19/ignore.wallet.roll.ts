/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Transaction } from '@soonaverse/interfaces';
import { FirebaseApp } from '../../../src/firebase/app/app';
import { Firestore } from '../../../src/firebase/firestore/firestore';

export const ignoreWalletRoll = async (app: FirebaseApp) => {
  const db = new Firestore(app);
  let lastDocId = '';

  do {
    const lastDoc = lastDocId
      ? await db.doc(`${COL.TRANSACTION}/${lastDocId}`).getSnapshot()
      : undefined;
    const snap = await db
      .collection(COL.TRANSACTION)
      .where('payload.ignoreWallet', 'in', [true, false])
      .startAfter(lastDoc)
      .limit(500)
      .get<Transaction>();

    const batch = db.batch();
    snap.forEach((transaction) => {
      const docRef = db.doc(`${COL.TRANSACTION}/${transaction.uid}`);
      batch.update(docRef, {
        'payload.ignoreWallet': db.deleteField(),
        'payload.ignoreWalletReason': db.deleteField(),
        ignoreWallet: transaction.payload.ignoreWallet || false,
        ignoreWalletReason: transaction.payload.ignoreWalletReason || '',
      });
    });
    await batch.commit();
  } while (lastDocId);
};

export const roll = ignoreWalletRoll;
