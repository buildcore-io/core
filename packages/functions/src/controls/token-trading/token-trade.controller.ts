import {
  COL,
  SUB_COL,
  Token,
  TokenTradeOrderType,
  TradeTokenRequest,
  WenError,
} from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { createTokenTradeOrder } from '../../services/payment/tangle-service/token/token-trade.service';
import { invalidArgument } from '../../utils/error.utils';
import { getTokenBySymbol } from '../../utils/token.utils';

export const tradeTokenControl = async (
  owner: string,
  params: TradeTokenRequest,
  customParams?: Record<string, unknown>,
) => {
  let token = await getTokenBySymbol(params.symbol);

  return await build5Db().runTransaction(async (transaction) => {
    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token?.uid}`);
    token = await transaction.get<Token>(tokenDocRef);
    if (!token) {
      throw invalidArgument(WenError.token_does_not_exist);
    }
    if (token.tradingDisabled) {
      throw invalidArgument(WenError.token_trading_disabled);
    }

    const { tradeOrderTransaction, tradeOrder, distribution } = await createTokenTradeOrder(
      transaction,
      owner,
      token,
      params.type as TokenTradeOrderType,
      params.count,
      params.price,
      customParams?.ip as string | undefined,
    );
    if (tradeOrder) {
      const orderDocRef = build5Db().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`);
      transaction.create(orderDocRef, tradeOrder);
      const distributionDocRef = build5Db().doc(
        `${COL.TOKEN}/${token?.uid}/${SUB_COL.DISTRIBUTION}/${owner}`,
      );
      transaction.update(distributionDocRef, distribution);
    } else {
      const tranDocRef = build5Db().doc(`${COL.TRANSACTION}/${tradeOrderTransaction.uid}`);
      transaction.create(tranDocRef, tradeOrderTransaction);
    }
    return tradeOrder || tradeOrderTransaction;
  });
};
