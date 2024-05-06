import { TransactionPayloadType } from '@buildcore/interfaces';
import { BaseService, HandlerParams } from '../base';

export class MintedTokenClaimService extends BaseService {
  public handleRequest = async ({ order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);
    if (order.payload.amount !== match.to.amount) {
      await this.transactionService.createCredit(
        TransactionPayloadType.INVALID_AMOUNT,
        payment,
        match,
      );
      return;
    }
    this.transactionService.markAsReconciled(order, match.msgId);
  };
}
