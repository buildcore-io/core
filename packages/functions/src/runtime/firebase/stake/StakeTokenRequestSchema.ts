import {
  MAX_WEEKS_TO_STAKE,
  MIN_WEEKS_TO_STAKE,
  StakeType,
  TokenStakeRequest,
} from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';

const KEY_COUNT = 5;
const FIELD_NAME_LENGTH = 50;
const FIELD_VALUE_LENGTH = 255;

export const depositStakeSchema = {
  symbol: CommonJoi.tokenSymbol().description('Symbol of the token.'),
  weeks: Joi.number()
    .integer()
    .min(MIN_WEEKS_TO_STAKE)
    .max(MAX_WEEKS_TO_STAKE)
    .required()
    .description(
      `Amount of weeks for which the tokens will be staked. Minimum ${MIN_WEEKS_TO_STAKE}, maximum ${MAX_WEEKS_TO_STAKE}`,
    ),
  type: Joi.string()
    .equal(...Object.values(StakeType))
    .required()
    .description('Type of the stake.'),
  customMetadata: Joi.object()
    .max(5)
    .pattern(Joi.string().max(50), Joi.string().max(255))
    .optional()
    .description(
      `Custom metadata object. It can have ${KEY_COUNT} field. \n` +
        `For each field the name can be maximum ${FIELD_NAME_LENGTH} character long. \n` +
        `For each field  the value can be ${FIELD_VALUE_LENGTH} characters long.`,
    ),
};

export const depositStakeSchemaObject = toJoiObject<TokenStakeRequest>(depositStakeSchema)
  .description('Request object to create a token stake order.')
  .meta({
    className: 'TokenStakeRequest',
  });
