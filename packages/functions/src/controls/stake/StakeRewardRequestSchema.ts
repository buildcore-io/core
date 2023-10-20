import {
  MAX_MILLISECONDS,
  MAX_TOTAL_TOKEN_SUPPLY,
  TokenStakeRewardRequest,
  TokenStakeRewardsRequest,
} from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

const MIN_START_DATE = 0;
const MAX_START_DATE = MAX_MILLISECONDS;
const MIN_DISTRIBUTION = 1;
const MAX_DISTRIBUTION = MAX_TOTAL_TOKEN_SUPPLY;

const MIN_REWARDS = 1;
const MAX_REWARDS = 500;

export const stakeRewardSchema = toJoiObject<TokenStakeRewardRequest>({
  startDate: Joi.number()
    .min(MIN_START_DATE)
    .max(MAX_MILLISECONDS)
    .integer()
    .required()
    .description(
      `Staring date of the reward in milliseconds. The base is current date. \n` +
        `Minimum ${MIN_START_DATE}, maximum ${MAX_START_DATE}`,
    ),
  endDate: Joi.number()
    .min(MIN_START_DATE)
    .max(MAX_START_DATE)
    .greater(Joi.ref('startDate'))
    .integer()
    .required()
    .description(
      `End date of the reward in milliseconds. The base is current date. \n` +
        `Minimum ${MIN_START_DATE}, maximum ${MAX_START_DATE}, and it has to be after start date.`,
    ),
  tokenVestingDate: Joi.number()
    .min(MIN_START_DATE)
    .max(MAX_START_DATE)
    .greater(Joi.ref('endDate'))
    .integer()
    .required()
    .description(
      `Vesting time of the reward in milliseconds. The base is current date. \n` +
        `Minimum ${MIN_START_DATE}, maximum ${MAX_START_DATE}, and it has to be after end date.`,
    ),
  tokensToDistribute: Joi.number()
    .min(MIN_DISTRIBUTION)
    .max(MAX_DISTRIBUTION)
    .required()
    .description(
      `Amount of tokens to be distributed with this reward. Minimum ${MIN_DISTRIBUTION}, maximum ${MAX_DISTRIBUTION}`,
    ),
})
  .description('Object to create a stake reward.')
  .meta({
    className: 'TokenStakeRewardRequest',
  });

export const stakeRewardsSchema = toJoiObject<TokenStakeRewardsRequest>({
  token: CommonJoi.uid().description('Build5 if of the token.'),
  items: Joi.array()
    .min(MIN_REWARDS)
    .max(MAX_REWARDS)
    .items(stakeRewardSchema)
    .description(`Stake reward items. Minimum ${MIN_REWARDS}, maximum ${MAX_REWARDS}.`),
})
  .description('Request object to create stake rewards.')
  .meta({
    className: 'TokenStakeRewardsRequest',
  });
