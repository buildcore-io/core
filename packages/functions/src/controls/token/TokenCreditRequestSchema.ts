import { CreditTokenRequest, MAX_IOTA_AMOUNT, MIN_IOTA_AMOUNT } from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const creditTokenSchema = toJoiObject<CreditTokenRequest>({
  token: CommonJoi.uid().description('Build5 id of the token.'),
  amount: Joi.number()
    .min(MIN_IOTA_AMOUNT)
    .max(MAX_IOTA_AMOUNT)
    .required()
    .description(`Amoun to credit. Minimum ${MIN_IOTA_AMOUNT}, maximum ${MAX_IOTA_AMOUNT}`),
})
  .description('Request object to credit a token purchase order.')
  .meta({
    className: 'CreditTokenRequest',
  });
