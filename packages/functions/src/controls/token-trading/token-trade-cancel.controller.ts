import {
  COL,
  CancelTokenTradeOrderRequest,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  WenError,
} from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { invalidArgument } from '../../utils/error.utils';
import { cancelTradeOrderUtil } from '../../utils/token-trade.utils';

export const cancelTradeOrderControl = (owner: string, params: CancelTokenTradeOrderRequest) =>
  build5Db().runTransaction(async (transaction) => {
    const tradeOrderDocRef = build5Db().doc(`${COL.TOKEN_MARKET}/${params.uid}`);
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
