import { MAX_TOTAL_TOKEN_SUPPLY, SpaceUpdateRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { createSpaceSchema } from './SpaceCreateRequestSchema';

const MIN_STAKE_VALUE = 1;
const MAX_STAKE_VALUE = MAX_TOTAL_TOKEN_SUPPLY;
export const updateSpaceSchema = toJoiObject<SpaceUpdateRequest>({
  ...createSpaceSchema,
  uid: CommonJoi.uid().description('Buildcore id of the space.'),
  tokenBased: Joi.boolean()
    .allow(false, true)
    .optional()
    .description('Set or unset the space to be token based.'),
  minStakedValue: Joi.number()
    .when('tokenBased', {
      is: Joi.exist().valid(true),
      then: Joi.number().min(MIN_STAKE_VALUE).max(MAX_STAKE_VALUE).integer().required(),
      otherwise: Joi.forbidden(),
    })
    .description(
      `If tokenBase is set to true, it defines the minimum stake joining value for the space. Minimum ${MIN_STAKE_VALUE}, maximum ${MAX_STAKE_VALUE}`,
    ),
})
  .description('Request object to update a space.')
  .meta({
    className: 'SpaceUpdateRequest',
  });
