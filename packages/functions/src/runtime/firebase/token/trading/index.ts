<<<<<<< HEAD
import { WEN_FUNC } from '@build-5/interfaces';
=======
import {
  CancelTokenTradeOrderRequest,
  EthAddress,
  MAX_IOTA_AMOUNT,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_PRICE_PER_TOKEN,
  StakeType,
  TokenTradeOrderType,
  TradeTokenRequest,
  WEN_FUNC,
} from '@build-5/interfaces';
import Joi from 'joi';
>>>>>>> master
import { cancelTradeOrderControl } from '../../../../controls/token-trading/token-trade-cancel.controller';
import { tradeTokenControl } from '../../../../controls/token-trading/token-trade.controller';
import { onRequest } from '../../../../firebase/functions/onRequest';
import { cancelTradeOrderSchema } from './TokenCanelTradeOrderRequestSchema';
import { tradeTokenSchema } from './TokenTradeRequestSchema';

export const cancelTradeOrder = onRequest(WEN_FUNC.cancelTradeOrder)(
  cancelTradeOrderSchema,
  cancelTradeOrderControl,
);

<<<<<<< HEAD
=======
export const tradeTokenSchema = toJoiObject<TradeTokenRequest>({
  symbol: CommonJoi.tokenSymbol(),
  count: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).integer().required(),
  price: Joi.number().min(MIN_PRICE_PER_TOKEN).max(MAX_IOTA_AMOUNT).precision(3).required(),
  type: Joi.string().equal(TokenTradeOrderType.SELL, TokenTradeOrderType.BUY).required(),
});

>>>>>>> master
export const tradeToken = onRequest(WEN_FUNC.tradeToken, undefined, { convert: false })(
  tradeTokenSchema,
  tradeTokenControl,
);
