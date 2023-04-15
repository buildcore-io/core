/* eslint-disable @typescript-eslint/no-explicit-any */
import { COL, Transaction } from '@soonaverse/interfaces';
import { FirebaseApp } from '../../../src/firebase/app/app';
import { Firestore } from '../../../src/firebase/firestore/firestore';

export const ignoreWalletRoll = async (app: FirebaseApp) => {
  const db = new Firestore(app);
  let size = 0;
  do {
    const snap = await db
      .collection(COL.TRANSACTION)
      .where('payload.ignoreWallet', 'in', [true, false])
      .limit(500)
      .get<Transaction>();
    size = snap.length;

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
  } while (size);
};

export const roll = ignoreWalletRoll;
