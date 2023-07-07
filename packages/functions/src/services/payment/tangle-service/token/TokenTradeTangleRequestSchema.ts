import { MAX_IOTA_AMOUNT, TokenTradeOrderType, TradeTokenTangleRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../joi/common';

const MIN_PRICE = 0.001;
const MAX_PRICE = MAX_IOTA_AMOUNT;

export const tradeMintedTokenSchema = toJoiObject<TradeTokenTangleRequest>({
  symbol: CommonJoi.tokenSymbol().description('Symbol of the token to trade.'),
  price: Joi.number()
    .min(MIN_PRICE)
    .max(MAX_PRICE)
    .precision(3)
    .required()
    .description(`Pirce of the token to trade. Minimum ${MIN_PRICE}, maximum: ${MAX_PRICE}.`),
  type: Joi.string()
    .equal(TokenTradeOrderType.SELL, TokenTradeOrderType.BUY)
    .required()
    .description('Direction of the trade.'),
})
  .description('Tangle request object to trade a token.')
  .meta({
    className: 'TradeTokenTangleRequest',
  });
