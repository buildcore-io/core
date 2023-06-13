import { COL, Transaction, TransactionType } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../firebase/firestore/build5Db';
import { ProcessingService } from '../services/payment/payment-processing';

export const voidExpiredOrdersCron = async () => {
  const snap = await build5Db()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.ORDER)
    .where('payload.void', '==', false)
    .where('payload.reconciled', '==', false)
    .where('payload.expiresOn', '<=', dayjs().toDate())
    .get<Transaction>();

  for (const tran of snap) {
    await build5Db().runTransaction(async (transaction) => {
      const tranDocRef = build5Db().doc(`${COL.TRANSACTION}/${tran.uid}`);
      const tranData = (await transaction.get<Transaction>(tranDocRef))!;
      const service: ProcessingService = new ProcessingService(transaction);
      await service.markAsVoid(tranData);
      service.submit();
    });
  }

  return null;
};
