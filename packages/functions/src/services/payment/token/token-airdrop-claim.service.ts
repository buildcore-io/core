import { TransactionPayloadType } from '@buildcore/interfaces';
import { BaseService, HandlerParams } from '../base';

export class TokenAirdropClaimService extends BaseService {
  public handleRequest = async ({ order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);
    await this.transactionService.createCredit(
      TransactionPayloadType.PRE_MINTED_CLAIM,
      payment,
      match,
    );
    this.transactionService.markAsReconciled(order, match.msgId);
  };
}
