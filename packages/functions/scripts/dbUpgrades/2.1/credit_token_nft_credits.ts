import { FirebaseApp, Firestore, build5Db } from '@build-5/database';
import { COL, Transaction, TransactionType } from '@build-5/interfaces';

const uids = [
  '0x37d1110a2e61c34b533808c61a8fd9cf9940a886',
  '0xef9a3cfcc9f273e7d089a833df771ad05bd34e01',
  '0x80bb899086797cd08dc65d0fab92eb135e0de11a',
  '0xf4c162b3792cca949b07e615c35ca928f540c1a0',
  '0x0747d2ca3f521d2312258bbdfc897dfc4de1dc56',
];

export const confirmScamNftCredits = async (app: FirebaseApp) => {
  const db = new Firestore(app);

  for (const uid of uids) {
    const docRef = build5Db().doc(`${COL.TRANSACTION}/${uid}`);
    const transaction = docRef.get<Transaction>();
    if (!transaction) {
      continue;
    }

    await docRef.update({
      shouldRetry: true,
      type: TransactionType.CREDIT,
      payload: {
        walletReference: db.deleteField(),
        response: { code: 2137, message: 'Invalid nft id.', status: 'error' },
        nft: db.deleteField(),
        nftId: db.deleteField(),
      },
    });
  }
};

export const roll = confirmScamNftCredits;
