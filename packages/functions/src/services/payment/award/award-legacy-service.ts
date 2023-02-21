import { COL, Transaction } from '@soonaverse/interfaces';
import admin from '../../../admin.config';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class LegacyAwardService {
  constructor(readonly transactionService: TransactionService) {}

  public handleLegacyAwardFundingOrder = async (order: Transaction, match: TransactionMatch) => {
    await this.transactionService.createPayment(order, match);
    this.transactionService.markAsReconciled(order, match.msgId);

    const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
    this.transactionService.updates.push({
      ref: orderDocRef,
      data: { 'payload.legacyAwardsBeeingFunded': 0 },
      action: 'update',
    });
  };
}
