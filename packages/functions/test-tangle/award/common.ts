import { COL, TransactionAwardType, TransactionType } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { wait } from '../../test/controls/common';

export const awaitAllTransactionsForAward = async (awardId: string) => {
  const baseTransQuery = admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.award', '==', awardId)
    .where('type', 'in', [TransactionType.BILL_PAYMENT, TransactionType.CREDIT]);
  await allConfirmed(baseTransQuery);

  const nttQuery = admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('payload.award', '==', awardId)
    .where('payload.type', '==', TransactionAwardType.BADGE);
  await allConfirmed(nttQuery);
};

const allConfirmed = (query: admin.firestore.Query<admin.firestore.DocumentData>) =>
  wait(async () => {
    const snap = await query.get();
    const allConfirmed = snap.docs.reduce(
      (acc, doc) => acc && doc.data()?.payload?.walletReference?.confirmed,
      true,
    );
    return allConfirmed;
  });
