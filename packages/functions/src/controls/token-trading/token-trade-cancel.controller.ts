import { build5Db } from '@build-5/database';
import {
  COL,
  CancelTokenTradeOrderRequest,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  WenError,
} from '@build-5/interfaces';
import { Context } from '../../runtime/firebase/common';
import { invalidArgument } from '../../utils/error.utils';
import { cancelTradeOrderUtil } from '../../utils/token-trade.utils';

export const cancelTradeOrderControl = ({ owner }: Context, params: CancelTokenTradeOrderRequest) =>
  build5Db().runTransaction(async (transaction) => {
    const tradeOrderDocRef = build5Db().doc(`${COL.TOKEN_MARKET}/${params.uid}`);
    const tradeOrder = await transaction.get<TokenTradeOrder>(tradeOrderDocRef);
    if (tradeOrder?.owner !== owner || tradeOrder.status !== TokenTradeOrderStatus.ACTIVE) {
      throw invalidArgument(WenError.invalid_params);
    }
    return await cancelTradeOrderUtil(transaction, tradeOrder);
  });
