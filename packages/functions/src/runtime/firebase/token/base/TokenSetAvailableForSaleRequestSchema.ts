import {
  MIN_TOKEN_START_DATE_DAY,
  SetTokenForSaleRequest,
  TRANSACTION_AUTO_EXPIRY_MS,
  TRANSACTION_MAX_EXPIRY_MS,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../../services/joi/common';
import { isProdEnv } from '../../../../utils/config.utils';
import { MAX_PRICE, MIN_PRICE } from './common';

const MIN_COOL_DOWN = 0;

export const setAvailableForSaleSchema = toJoiObject<SetTokenForSaleRequest>({
  token: CommonJoi.uid().description('Build5 id of the token.'),
  saleStartDate: Joi.date()
    .greater(
      dayjs()
        .add(isProdEnv() ? MIN_TOKEN_START_DATE_DAY : 0, 'd')
        .toDate(),
    )
    .required()
    .description(
      `Start date of the sale. It has to be ${MIN_TOKEN_START_DATE_DAY} days in the future.`,
    ),
  saleLength: Joi.number()
    .min(TRANSACTION_AUTO_EXPIRY_MS)
    .max(TRANSACTION_MAX_EXPIRY_MS)
    .required()
    .description(
      `Length of the sale in milliseconds. Minimum ${TRANSACTION_AUTO_EXPIRY_MS}, maximum ${TRANSACTION_MAX_EXPIRY_MS}`,
    ),
  coolDownLength: Joi.number()
    .min(MIN_COOL_DOWN)
    .max(TRANSACTION_MAX_EXPIRY_MS)
    .required()
    .description(
      `Length of the cool down period. Minimum ${MIN_COOL_DOWN}, maximum ${TRANSACTION_MAX_EXPIRY_MS}`,
    ),
  autoProcessAt100Percent: Joi.boolean()
    .optional()
    .description('If true, purchases will be fullfilled once reuqest reach 100%.'),
  pricePerToken: Joi.number()
    .min(MIN_PRICE)
    .max(MAX_PRICE)
    .precision(3)
    .required()
    .description(`Price per token. Minimum ${MIN_PRICE}, maximum ${MAX_PRICE}.`),
})
  .description('Request object to update a token.')
  .meta({
    className: 'SetTokenForSaleRequest',
  });
