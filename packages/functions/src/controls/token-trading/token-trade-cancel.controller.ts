import { COL, TokenTradeOrder, TokenTradeOrderStatus, WenError } from '@build5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { invalidArgument } from '../../utils/error.utils';
import { cancelTradeOrderUtil } from '../../utils/token-trade.utils';

export const cancelTradeOrderControl = (owner: string, params: Record<string, unknown>) =>
  soonDb().runTransaction(async (transaction) => {
    const tradeOrderDocRef = soonDb().doc(`${COL.TOKEN_MARKET}/${params.uid}`);
    const tradeOrder = await transaction.get<TokenTradeOrder>(tradeOrderDocRef);
    if (
      !tradeOrder ||
      tradeOrder.owner !== owner ||
      tradeOrder.status !== TokenTradeOrderStatus.ACTIVE
    ) {
      throw invalidArgument(WenError.invalid_params);
    }
    return await cancelTradeOrderUtil(transaction, tradeOrder);
  });
