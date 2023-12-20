import {
  MAX_IOTA_AMOUNT,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_PRICE_PER_TOKEN,
  TangleRequestType,
  TradeTokenTangleRequest,
} from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

const MAX_PRICE = MAX_IOTA_AMOUNT;

const MIN_COUNT = 1;
const MAX_COUNT = MAX_TOTAL_TOKEN_SUPPLY;

export const tradeMintedTokenSchema = toJoiObject<TradeTokenTangleRequest>({
  ...baseTangleSchema(TangleRequestType.BUY_TOKEN, TangleRequestType.SELL_TOKEN),
  symbol: CommonJoi.tokenSymbol().description('Symbol of the token to trade.'),
  price: Joi.number()
    .min(MIN_PRICE_PER_TOKEN)
    .max(MAX_PRICE)
    .precision(6)
    .optional()
    .description(
      `Price of the token to trade. Minimum ${MIN_PRICE_PER_TOKEN}, maximum: ${MAX_PRICE}.`,
    ),
  count: Joi.number()
    .min(MIN_COUNT)
    .max(MAX_COUNT)
    .integer()
    .optional()
    .description(
      `Count of the tokens to be bought. Only specify is type is BUY. ` +
        `Minimum ${MIN_COUNT}, maximum ${MAX_COUNT}`,
    ),
  targetAddress: CommonJoi.uid(false).description(
    'Funds will be sent here in case of a successfull trade.',
  ),
})
  .description('Tangle request object to trade a token.')
  .meta({
    className: 'TradeTokenTangleRequest',
  });
