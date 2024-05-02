import { database } from '@buildcore/database';
import {
  COL,
  SUB_COL,
  Token,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
} from '@buildcore/interfaces';
import bigDecimal from 'js-big-decimal';
import { getBoughtByMemberDiff, getTotalPublicSupply } from '../../../utils/token.utils';
import { BaseService, HandlerParams } from '../base';
import { Action, TransactionMatch } from '../transaction-service';

export class TokenPurchaseService extends BaseService {
  public handleRequest = async ({ order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);
    await this.updateTokenDistribution(order, match, payment);
  };

  private async updateTokenDistribution(
    order: Transaction,
    tran: TransactionMatch,
    payment: Transaction,
  ) {
    const tokenRef = database().doc(COL.TOKEN, order.payload.token!);
    const distributionRef = database().doc(
      COL.TOKEN,
      order.payload.token!,
      SUB_COL.DISTRIBUTION,
      order.member!,
    );

    const token = <Token>await this.transaction.get(tokenRef);
    if (token.status !== TokenStatus.AVAILABLE) {
      await this.transactionService.createCredit(
        TransactionPayloadType.DATA_NO_LONGER_VALID,
        payment,
        tran,
      );
      return;
    }

    const distribution = await this.transaction.get(distributionRef);
    const currentTotalDeposit = Number(
      bigDecimal.add(distribution?.totalDeposit || 0, tran.to.amount),
    );
    const boughtByMemberDiff = getBoughtByMemberDiff(
      distribution?.totalDeposit || 0,
      currentTotalDeposit,
      token.pricePerToken,
    );

    const tokenUpdateData = {
      totalDeposit: database().inc(tran.to.amount),
      tokensOrdered: database().inc(boughtByMemberDiff),
    };
    const tokensOrdered = Number(bigDecimal.add(token.tokensOrdered, boughtByMemberDiff));
    const totalPublicSupply = getTotalPublicSupply(token);

    this.transactionService.push({
      ref: tokenRef,
      data:
        tokensOrdered >= totalPublicSupply && token.autoProcessAt100Percent
          ? { ...tokenUpdateData, status: TokenStatus.PROCESSING }
          : tokenUpdateData,
      action: Action.U,
    });

    this.transactionService.push({
      ref: distributionRef,
      data: { totalDeposit: database().inc(tran.to.amount) },
      action: Action.UPS,
    });
  }
}
