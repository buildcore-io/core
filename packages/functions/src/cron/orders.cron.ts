import { COL, Transaction, TransactionType } from '@build5/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../firebase/firestore/soondb';
import { ProcessingService } from '../services/payment/payment-processing';

export const voidExpiredOrdersCron = async () => {
  const snap = await soonDb()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.ORDER)
    .where('payload.void', '==', false)
    .where('payload.reconciled', '==', false)
    .where('payload.expiresOn', '<=', dayjs().toDate())
    .get<Transaction>();

  for (const tran of snap) {
    await soonDb().runTransaction(async (transaction) => {
      const tranDocRef = soonDb().doc(`${COL.TRANSACTION}/${tran.uid}`);
      const tranData = (await transaction.get<Transaction>(tranDocRef))!;
      const service: ProcessingService = new ProcessingService(transaction);
      await service.markAsVoid(tranData);
      service.submit();
    });
  }

  return null;
};
