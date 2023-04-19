import {
  MAX_IOTA_AMOUNT,
  MAX_TOTAL_TOKEN_SUPPLY,
  TokenTradeOrderType,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import Joi from 'joi';
import { cancelTradeOrderControl } from '../../../../controls/token-trading/token-trade-cancel.controller';
import { tradeTokenControl } from '../../../../controls/token-trading/token-trade.controller';
import { onRequest } from '../../../../firebase/functions/onRequest';
import { CommonJoi } from '../../../../services/joi/common';
import { uidSchema } from '../../common';

export const cancelTradeOrder = onRequest(WEN_FUNC.cancelTradeOrder)(
  uidSchema,
  cancelTradeOrderControl,
);

export const tradeTokenSchema = Joi.object({
  symbol: CommonJoi.tokenSymbol(),
  count: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).integer().required(),
  price: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).required(),
  type: Joi.string().equal(TokenTradeOrderType.SELL, TokenTradeOrderType.BUY).required(),
});

export const tradeToken = onRequest(WEN_FUNC.tradeToken, undefined, { convert: false })(
  tradeTokenSchema,
  tradeTokenControl,
);
