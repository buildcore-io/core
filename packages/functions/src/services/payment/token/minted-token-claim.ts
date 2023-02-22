import { TransactionCreditType, TransactionOrder } from '@soonaverse/interfaces';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class MintedTokenClaimService {
  constructor(readonly transactionService: TransactionService) {}

  public handleClaimRequest = async (order: TransactionOrder, match: TransactionMatch) => {
    const payment = await this.transactionService.createPayment(order, match);
    if (order.payload.amount !== match.to.amount) {
      await this.transactionService.createCredit(
        TransactionCreditType.INVALID_AMOUNT,
        payment,
        match,
      );
      return;
    }
    this.transactionService.markAsReconciled(order, match.msgId);
  };
}
