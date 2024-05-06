import {
  MAX_AIRDROP,
  MAX_TOTAL_TOKEN_SUPPLY,
  NetworkAddress,
  StakeType,
} from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { MAX_COUNT, MIN_AIRDROP, MIN_COUNT } from './common';

export interface AirdropRequest {
  vestingAt: Date;
  count: number;
  recipient: NetworkAddress;
  stakeType: StakeType;
}

// TODO - remove this
export interface CreateAirdropsRequest {
  token: NetworkAddress;
  drops: AirdropRequest[];
}

export const airdropTokenSchema = toJoiObject<CreateAirdropsRequest>({
  token: CommonJoi.uid().description('Buildcore id of the token'),
  drops: Joi.array()
    .required()
    .items(
      toJoiObject<AirdropRequest>({
        vestingAt: Joi.date().required().description('Date when the airdrop will be vested.'),
        count: Joi.number()
          .min(MIN_COUNT)
          .max(MAX_COUNT)
          .integer()
          .required()
          .description(
            `Amount of tokens to be airdroped. Minimum ${MIN_COUNT}, maximum ${MAX_TOTAL_TOKEN_SUPPLY}`,
          ),
        recipient: CommonJoi.uid().description('Buildcore id or wallet address of the recipient'),
        stakeType: Joi.string()
          .equal(StakeType.STATIC, StakeType.DYNAMIC)
          .optional()
          .description('Type of the stake used for the airdrop'),
      }),
    )
    .min(MIN_AIRDROP)
    .max(MAX_AIRDROP)
    .description('Array of airdrops'),
})
  .description('Request object to airdrop tokens.')
  .meta({
    className: 'CreateAirdropsRequest',
  });
