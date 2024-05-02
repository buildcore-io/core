import { build5Db } from '@build-5/database';
import {
  COL,
  SUB_COL,
  TokenTradeOrderType,
  TradeTokenRequest,
  WenError,
} from '@build-5/interfaces';
import { createTokenTradeOrder } from '../../services/payment/tangle-service/token/token-trade.service';
import { invalidArgument } from '../../utils/error.utils';
import { getTokenBySymbol } from '../../utils/token.utils';
import { Context } from '../common';

export const tradeTokenControl = async ({
  ip,
  owner,
  params,
  project,
}: Context<TradeTokenRequest>) => {
  let token = await getTokenBySymbol(params.symbol);
  if (!token?.uid) {
    throw invalidArgument(WenError.token_does_not_exist);
  }

  return await build5Db().runTransaction(async (transaction) => {
    const tokenDocRef = build5Db().doc(COL.TOKEN, token?.uid!);
    token = await transaction.get(tokenDocRef);
    if (!token) {
      throw invalidArgument(WenError.token_does_not_exist);
    }
    if (token.tradingDisabled) {
      throw invalidArgument(WenError.token_trading_disabled);
    }

    const { tradeOrderTransaction, tradeOrder, distribution } = await createTokenTradeOrder(
      project,
      transaction,
      owner,
      token,
      params.type as TokenTradeOrderType,
      params.count,
      params.price,
      '',
      ip,
    );
    if (tradeOrder) {
      const orderDocRef = build5Db().doc(COL.TOKEN_MARKET, tradeOrder.uid);
      await transaction.create(orderDocRef, tradeOrder);
      const distributionDocRef = build5Db().doc(COL.TOKEN, token?.uid, SUB_COL.DISTRIBUTION, owner);
      await transaction.update(distributionDocRef, distribution);
    } else {
      const tranDocRef = build5Db().doc(COL.TRANSACTION, tradeOrderTransaction.uid);
      await transaction.create(tranDocRef, tradeOrderTransaction);
    }
    return tradeOrder || tradeOrderTransaction;
  });
};
