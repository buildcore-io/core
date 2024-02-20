import { FirebaseApp, Firestore } from '@build-5/database';
import { COL, Transaction } from '@build-5/interfaces';

export const nftWithdrawSenderFix = async (app: FirebaseApp) => {
  const db = new Firestore(app);

  const docRef = db.doc(`${COL.TRANSACTION}/0x5a1091b6642aea292b89b448785742e76cd2d854`);
  const transaction = await docRef.get<Transaction>();
  if (!transaction) {
    return;
  }

  await docRef.update({
    'payload.walletReference.chainReferences': [
      '0xec569481b9ab17cea187466e5d08ce4f3ef6f527e471a6b2297611ed4f2bf27a',
    ],
    'payload.walletReference.count': 1,
    'payload.walletReference.confirmed': true,
    'payload.walletReference.chainReference':
      '0xec569481b9ab17cea187466e5d08ce4f3ef6f527e471a6b2297611ed4f2bf27a',
  });
};

export const roll = nftWithdrawSenderFix;
