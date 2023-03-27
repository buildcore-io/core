import { COL, SUB_COL, Token, TokenTradeOrderType, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../../database/wrapper/soondb';
import { createTokenTradeOrder } from '../../services/payment/tangle-service/token-trade.service';
import { throwInvalidArgument } from '../../utils/error.utils';
import { getTokenBySymbol } from '../../utils/token.utils';

export const tradeTokenControl = async (
  owner: string,
  params: Record<string, unknown>,
  customParams?: Record<string, unknown>,
) => {
  let token = await getTokenBySymbol(params.symbol as string);

  return await soonDb().runTransaction(async (transaction) => {
    const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${token?.uid}`);
    token = await transaction.get<Token>(tokenDocRef);
    if (!token) {
      throw throwInvalidArgument(WenError.token_does_not_exist);
    }
    if (token.tradingDisabled) {
      throw throwInvalidArgument(WenError.token_trading_disabled);
    }

    const { tradeOrderTransaction, tradeOrder, distribution } = await createTokenTradeOrder(
      transaction,
      owner,
      token,
      params.type as TokenTradeOrderType,
      params.count as number,
      params.price as number,
      customParams?.ip as string | undefined,
    );
    if (tradeOrder) {
      const orderDocRef = soonDb().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`);
      transaction.create(orderDocRef, tradeOrder);
      const distributionDocRef = soonDb().doc(
        `${COL.TOKEN}/${token?.uid}/${SUB_COL.DISTRIBUTION}/${owner}`,
      );
      transaction.update(distributionDocRef, distribution);
    } else {
      const tranDocRef = soonDb().doc(`${COL.TRANSACTION}/${tradeOrderTransaction.uid}`);
      transaction.create(tranDocRef, tradeOrderTransaction);
    }
    return tradeOrder || tradeOrderTransaction;
  });
};
