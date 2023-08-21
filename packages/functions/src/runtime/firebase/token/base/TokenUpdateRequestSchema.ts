import {
  MAX_IOTA_AMOUNT,
  MIN_PRICE_PER_TOKEN,
  MintedTokenUpdateRequest,
  TokenUpdateRequest,
} from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../../services/joi/common';

const MAX_PRICE = MAX_IOTA_AMOUNT;

export const uptdateMintedTokenSchema = {
  title: Joi.string().required().allow(null, '').description('Title of the token'),
  description: Joi.string().required().allow(null, '').description('Description of the token'),
  shortDescriptionTitle: Joi.string()
    .required()
    .allow(null, '')
    .description('Short description title of the token'),
  shortDescription: Joi.string()
    .required()
    .allow(null, '')
    .description('Short description of the token'),
  links: Joi.array().min(0).items(Joi.string().uri()).description('Links for the token'),
  uid: CommonJoi.uid().description('Build5 id of the token.'),
  pricePerToken: Joi.number()
    .min(MIN_PRICE_PER_TOKEN)
    .max(MAX_IOTA_AMOUNT)
    .precision(6)
    .optional()
    .description(`Price per token. Minimum ${MIN_PRICE_PER_TOKEN}, maximum ${MAX_PRICE}.`),
};

export const updateTokenSchema = {
  name: Joi.string().required().allow(null, '').description('Name of the token'),
  ...uptdateMintedTokenSchema,
};

export const updateTokenSchemaObject = toJoiObject<TokenUpdateRequest>(updateTokenSchema)
  .description('Request object to update a token.')
  .meta({
    className: 'TokenUpdateRequest',
  });

export const uptdateMintedTokenSchemaObject = toJoiObject<MintedTokenUpdateRequest>(
  uptdateMintedTokenSchema,
)
  .description('Request object to update a minted token.')
  .meta({
    className: 'MintedTokenUpdateRequest',
  });
