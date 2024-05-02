import { MIN_PRICE_PER_TOKEN, TokenTradeOrderType, TradeTokenRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { MAX_COUNT, MAX_PRICE, MIN_COUNT } from '../token/common';

export const tradeTokenSchema = toJoiObject<TradeTokenRequest>({
  symbol: CommonJoi.tokenSymbol().description('Symbol of the token to trade.'),
  count: Joi.number()
    .min(MIN_COUNT)
    .max(MAX_COUNT)
    .integer()
    .required()
    .description(`Amount of tokens to be traded. Minimum ${MIN_COUNT}, maximum ${MAX_COUNT}`),
  price: Joi.number()
    .min(MIN_PRICE_PER_TOKEN)
    .max(MAX_PRICE)
    .precision(6)
    .required()
    .description(`Price per token. Minimum ${MIN_PRICE_PER_TOKEN}, maximum ${MAX_PRICE}.`),
  type: Joi.string()
    .equal(TokenTradeOrderType.SELL, TokenTradeOrderType.BUY)
    .required()
    .description('DIrection of the trade.'),
})
  .description('Request object to create a token trade order.')
  .meta({
    className: 'TradeTokenRequest',
  });
