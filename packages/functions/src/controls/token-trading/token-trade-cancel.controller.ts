import { database } from '@buildcore/database';
import {
  COL,
  CancelTokenTradeOrderRequest,
  TokenTradeOrderStatus,
  WenError,
} from '@buildcore/interfaces';
import { invalidArgument } from '../../utils/error.utils';
import { cancelTradeOrderUtil } from '../../utils/token-trade.utils';
import { Context } from '../common';

export const cancelTradeOrderControl = ({ owner, params }: Context<CancelTokenTradeOrderRequest>) =>
  database().runTransaction(async (transaction) => {
    const tradeOrderDocRef = database().doc(COL.TOKEN_MARKET, params.uid);
    const tradeOrder = await transaction.get(tradeOrderDocRef);
    if (tradeOrder?.owner !== owner || tradeOrder.status !== TokenTradeOrderStatus.ACTIVE) {
      throw invalidArgument(WenError.invalid_params);
    }
    return await cancelTradeOrderUtil(transaction, tradeOrder);
  });
