import { COL, TransactionOrder, TransactionType } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../admin.config';
import { ProcessingService } from '../services/payment/payment-processing';

export const voidExpiredOrdersCron = async () => {
  const qry = await admin
    .firestore()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.ORDER)
    .where('payload.void', '==', false)
    .where('payload.reconciled', '==', false)
    .where('payload.expiresOn', '<=', dayjs().toDate())
    .get();

  if (qry.size > 0) {
    for (const t of qry.docs) {
      await admin.firestore().runTransaction(async (transaction) => {
        const refSource = admin.firestore().collection(COL.TRANSACTION).doc(t.data().uid);
        const sfDoc = await transaction.get(refSource);
        const service: ProcessingService = new ProcessingService(transaction);
        await service.markAsVoid(<TransactionOrder>sfDoc.data());

        // This will trigger all update/set.
        service.submit();
      });
    }
  }

  // Finished.
  return null;
};
