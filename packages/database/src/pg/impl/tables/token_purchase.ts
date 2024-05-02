import {
  Network,
  TokenPurchase,
  TokenPurchaseAge,
  TokenStatus,
  TokenTradeOrderType,
} from '@build-5/interfaces';
import { Converter } from '../../interfaces/common';
import { PgTokenPurchase } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class TokenPurchaseConverter implements Converter<TokenPurchase, PgTokenPurchase> {
  toPg = (tp: TokenPurchase): PgTokenPurchase => ({
    uid: tp.uid,
    project: tp.project,
    createdOn: tp.createdOn?.toDate(),
    updatedOn: tp.updatedOn?.toDate(),
    createdBy: tp.createdBy,

    token: tp.token,
    tokenStatus: tp.tokenStatus,
    sell: tp.sell,
    buy: tp.buy,
    count: tp.count,
    price: tp.price,
    triggeredBy: tp.triggeredBy,
    billPaymentId: tp.billPaymentId,
    buyerBillPaymentId: tp.buyerBillPaymentId,
    royaltyBillPayments: tp.royaltyBillPayments,
    sourceNetwork: tp.sourceNetwork,
    targetNetwork: tp.targetNetwork,
    sellerTokenTradingFeePercentage: tp.sellerTokenTradingFeePercentage,
    sellerTier: tp.sellerTier,
    in24h: tp.age?.includes(TokenPurchaseAge.IN_24_H) || false,
    in48h: tp.age?.includes(TokenPurchaseAge.IN_48_H) || false,
    in7d: tp.age?.includes(TokenPurchaseAge.IN_7_D) || false,
  });

  fromPg = (pg: PgTokenPurchase): TokenPurchase =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',

      token: pg.token!,
      tokenStatus: (pg.tokenStatus as TokenStatus)!,
      sell: pg.sell!,
      buy: pg.buy!,
      count: pg.count!,
      price: pg.price!,
      triggeredBy: (pg.triggeredBy as TokenTradeOrderType)!,
      billPaymentId: pg.billPaymentId,
      buyerBillPaymentId: pg.buyerBillPaymentId,
      royaltyBillPayments: pg.royaltyBillPayments,
      sourceNetwork: pg.sourceNetwork as Network,
      targetNetwork: pg.targetNetwork as Network,
      sellerTokenTradingFeePercentage: pg.sellerTokenTradingFeePercentage,
      sellerTier: pg.sellerTier,
      age: Object.values(TokenPurchaseAge).reduce(
        (acc, act) => (pg[act] ? [...acc, act] : acc),
        [] as TokenPurchaseAge[],
      ),
    });
}
