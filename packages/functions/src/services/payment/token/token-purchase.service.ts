import { build5Db } from '@build-5/database';
import {
  COL,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  Transaction,
  TransactionPayloadType,
} from '@build-5/interfaces';
import bigDecimal from 'js-big-decimal';
import { getBoughtByMemberDiff, getTotalPublicSupply } from '../../../utils/token.utils';
import { BaseService, HandlerParams } from '../base';
import { TransactionMatch } from '../transaction-service';

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
    const tokenRef = build5Db().doc(`${COL.TOKEN}/${order.payload.token}`);
    const distributionRef = tokenRef.collection(SUB_COL.DISTRIBUTION).doc(order.member!);

    const token = <Token>await this.transactionService.get(tokenRef);
    if (token.status !== TokenStatus.AVAILABLE) {
      await this.transactionService.createCredit(
        TransactionPayloadType.DATA_NO_LONGER_VALID,
        payment,
        tran,
      );
      return;
    }

    const distribution = await this.transactionService.transaction.get<TokenDistribution>(
      distributionRef,
    );
    const currentTotalDeposit = Number(
      bigDecimal.add(distribution?.totalDeposit || 0, tran.to.amount),
    );
    const boughtByMemberDiff = getBoughtByMemberDiff(
      distribution?.totalDeposit || 0,
      currentTotalDeposit,
      token.pricePerToken,
    );

    const tokenUpdateData = {
      totalDeposit: build5Db().inc(tran.to.amount),
      tokensOrdered: build5Db().inc(boughtByMemberDiff),
    };
    const tokensOrdered = Number(bigDecimal.add(token.tokensOrdered, boughtByMemberDiff));
    const totalPublicSupply = getTotalPublicSupply(token);

    this.transactionService.push({
      ref: tokenRef,
      data:
        tokensOrdered >= totalPublicSupply && token.autoProcessAt100Percent
          ? { ...tokenUpdateData, status: TokenStatus.PROCESSING }
          : tokenUpdateData,
      action: 'update',
    });

    this.transactionService.push({
      ref: distributionRef,
      data: {
        uid: order.member,
        totalDeposit: build5Db().inc(tran.to.amount),
        parentId: order.payload.token,
        parentCol: COL.TOKEN,
      },
      action: 'set',
      merge: true,
    });
  }
}
