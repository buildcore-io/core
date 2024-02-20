import { FirebaseApp, Firestore } from '@build-5/database';
import { COL, Transaction } from '@build-5/interfaces';

const retry = [
  '0x09900e9492f141d192f509ea3150a5ae1b8ac2ad',
  '0xfbdb4c8071d8c79c0efa1c0a77f9da8bbc1b9ac9',
];

export const nftWithdrawSenderFix = async (app: FirebaseApp) => {
  const db = new Firestore(app);

  for (const uid of retry) {
    const docRef = db.doc(`${COL.TRANSACTION}/${uid}`);
    const transaction = await docRef.get<Transaction>();
    if (!transaction) {
      continue;
    }
    await docRef.update({
      shouldRetry: true,
      'payload.walletReference': db.deleteField(),
    });
  }
};

export const roll = nftWithdrawSenderFix;
