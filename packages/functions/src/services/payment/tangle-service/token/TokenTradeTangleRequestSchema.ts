import {
  MAX_IOTA_AMOUNT,
  MAX_TOTAL_TOKEN_SUPPLY,
  TokenTradeOrderType,
  TradeTokenTangleRequest,
} from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

const MIN_PRICE = 0.001;
const MAX_PRICE = MAX_IOTA_AMOUNT;

const MIN_COUNT = 1;
const MAX_COUNT = MAX_TOTAL_TOKEN_SUPPLY;

export const tradeMintedTokenSchema = toJoiObject<TradeTokenTangleRequest>({
  ...baseTangleSchema,
  symbol: CommonJoi.tokenSymbol().description('Symbol of the token to trade.'),
  price: Joi.number()
    .min(MIN_PRICE)
    .max(MAX_PRICE)
    .precision(3)
    .required()
    .description(`Pirce of the token to trade. Minimum ${MIN_PRICE}, maximum: ${MAX_PRICE}.`),
  count: Joi.number()
    .min(MIN_COUNT)
    .max(MAX_COUNT)
    .integer()
    .optional()
    .description(
      `Count of the tokens to be bought. Only specify is type is BUY. ` +
        `Minimum ${MIN_COUNT}, maximum ${MAX_COUNT}`,
    ),
  type: Joi.string()
    .equal(TokenTradeOrderType.SELL, TokenTradeOrderType.BUY)
    .required()
    .description('Direction of the trade.'),
})
  .description('Tangle request object to trade a token.')
  .meta({
    className: 'TradeTokenTangleRequest',
  });
