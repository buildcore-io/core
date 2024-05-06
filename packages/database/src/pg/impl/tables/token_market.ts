import {
  Network,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@buildcore/interfaces';
import { Converter } from '../../interfaces/common';
import { PgTokenMarket } from '../../models';
import { removeNulls } from '../common';
import { pgDateToTimestamp } from '../postgres';

export class TokenTradeOrderConverter implements Converter<TokenTradeOrder, PgTokenMarket> {
  toPg = (to: TokenTradeOrder): PgTokenMarket => ({
    uid: to.uid,
    project: to.project,
    createdOn: to.createdOn?.toDate(),
    updatedOn: to.updatedOn?.toDate(),
    createdBy: to.createdBy,

    owner: to.owner,
    token: to.token,
    tokenStatus: to.tokenStatus,
    type: to.type,
    count: to.count,
    price: to.price,
    totalDeposit: to.totalDeposit,
    balance: to.balance,
    fulfilled: to.fulfilled,
    status: to.status,
    orderTransactionId: to.orderTransactionId,
    paymentTransactionId: to.paymentTransactionId,
    creditTransactionId: to.creditTransactionId,
    expiresAt: to.expiresAt?.toDate(),
    shouldRetry: to.shouldRetry,
    sourceNetwork: to.sourceNetwork,
    targetNetwork: to.targetNetwork,
    targetAddress: to.targetAddress,
  });

  fromPg = (pg: PgTokenMarket): TokenTradeOrder =>
    removeNulls({
      uid: pg.uid,
      project: pg.project,
      createdOn: pgDateToTimestamp(pg.createdOn),
      updatedOn: pgDateToTimestamp(pg.updatedOn),
      createdBy: pg.createdBy || '',

      owner: pg.owner!,
      token: pg.token!,
      tokenStatus: (pg.tokenStatus as TokenStatus)!,
      type: (pg.type as TokenTradeOrderType)!,
      count: pg.count!,
      price: pg.price!,
      totalDeposit: pg.totalDeposit!,
      balance: pg.balance!,
      fulfilled: pg.fulfilled!,
      status: (pg.status as TokenTradeOrderStatus)!,
      orderTransactionId: pg.orderTransactionId,
      paymentTransactionId: pg.paymentTransactionId,
      creditTransactionId: pg.creditTransactionId,
      expiresAt: pgDateToTimestamp(pg.expiresAt)!,
      shouldRetry: pg.shouldRetry,
      sourceNetwork: pg.sourceNetwork as Network,
      targetNetwork: pg.targetNetwork as Network,
      targetAddress: pg.targetAddress,
    });
}
