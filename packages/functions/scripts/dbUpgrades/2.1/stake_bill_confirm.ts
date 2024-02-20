import { FirebaseApp, Firestore } from '@build-5/database';
import { COL, Transaction } from '@build-5/interfaces';
import { head } from 'lodash';

const uids = [
  '0xa37ff7053962e3bc7231ce8edbdb0e7d28bc75d9',
  '0x7d923d53b75e577574f1f6a2e7184abce02c77cf',
];

export const confirmStakeBillPayments = async (app: FirebaseApp) => {
  const db = new Firestore(app);

  for (const uid of uids) {
    const docRef = db.doc(`${COL.TRANSACTION}/${uid}`);
    const transaction = await docRef.get<Transaction>();
    if (!transaction) {
      continue;
    }

    await docRef.update({
      'payload.walletReference.confirmed': true,
      'payload.walletReference.error': null,
      'payload.walletReference.count': 1,
      'payload.walletReference.chainReference':
        head(transaction.payload.walletReference?.chainReferences) || null,
    });
  }
};

export const roll = confirmStakeBillPayments;
