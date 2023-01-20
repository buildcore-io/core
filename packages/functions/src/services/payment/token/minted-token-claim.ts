import { TransactionOrder } from '@soonaverse/interfaces';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class MintedTokenClaimService {
  constructor(readonly transactionService: TransactionService) {}

  public handleClaimRequest = async (order: TransactionOrder, match: TransactionMatch) => {
    const payment = this.transactionService.createPayment(order, match);
    if (order.payload.amount !== match.to.amount) {
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId);
  };
}
