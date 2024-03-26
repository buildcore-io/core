import { build5Db } from '@build-5/database';
import { COL, TransactionType } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { NftPurchaseService } from '../services/payment/nft/nft-purchase.service';
import { TransactionService } from '../services/payment/transaction-service';

export const voidExpiredOrdersCron = async () => {
  const transactions = await build5Db()
    .collection(COL.TRANSACTION)
    .where('type', '==', TransactionType.ORDER)
    .where('payload_void', '==', false)
    .where('payload_reconciled', '==', false)
    .where('payload_expiresOn', '<=', dayjs().toDate())
    .get();

  for (const tran of transactions) {
    await build5Db().runTransaction(async (transaction) => {
      const tranDocRef = build5Db().doc(COL.TRANSACTION, tran.uid);
      const tranData = (await transaction.get(tranDocRef))!;

      const tranService = new TransactionService(transaction);
      const service = new NftPurchaseService(tranService);
      await service.markAsVoid(tranData);
      await tranService.submit();
    });
  }

  return null;
};
