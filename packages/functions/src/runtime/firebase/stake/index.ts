import {
  MAX_MILLISECONDS,
  MAX_TOTAL_TOKEN_SUPPLY,
  MAX_WEEKS_TO_STAKE,
  MIN_WEEKS_TO_STAKE,
  StakeType,
  WEN_FUNC,
} from '@build-5/interfaces';
import Joi from 'joi';
import { depositStakeControl } from '../../../controls/stake/stake.deposit';
import { stakeRewardControl } from '../../../controls/stake/stake.reward';
import { removeStakeRewardControl } from '../../../controls/stake/stake.reward.revoke';
import { onRequest } from '../../../firebase/functions/onRequest';
import { CommonJoi } from '../../../services/joi/common';

export const depositStakeSchema = Joi.object({
  symbol: CommonJoi.tokenSymbol(),
  weeks: Joi.number().integer().min(MIN_WEEKS_TO_STAKE).max(MAX_WEEKS_TO_STAKE).required(),
  type: Joi.string()
    .equal(...Object.values(StakeType))
    .required(),
  customMetadata: Joi.object()
    .max(5)
    .pattern(Joi.string().max(50), Joi.string().max(255))
    .optional(),
});

export const depositStake = onRequest(WEN_FUNC.depositStake)(
  depositStakeSchema,
  depositStakeControl,
);

const stakeRewardSchema = Joi.object({
  token: CommonJoi.uid(),
  items: Joi.array()
    .min(1)
    .max(500)
    .items(
      Joi.object({
        startDate: Joi.number().min(0).max(MAX_MILLISECONDS).integer().required(),
        endDate: Joi.number()
          .min(0)
          .max(MAX_MILLISECONDS)
          .greater(Joi.ref('startDate'))
          .integer()
          .required(),
        tokenVestingDate: Joi.number()
          .min(0)
          .max(MAX_MILLISECONDS)
          .greater(Joi.ref('endDate'))
          .integer()
          .required(),
        tokensToDistribute: Joi.number().min(1).max(MAX_TOTAL_TOKEN_SUPPLY).required(),
      }),
    ),
});

export const stakeReward = onRequest(WEN_FUNC.stakeReward)(stakeRewardSchema, stakeRewardControl);

const removeStakeRewardSchema = Joi.object({
  stakeRewardIds: Joi.array().items(CommonJoi.uid()).min(1).max(450).required(),
});

export const removeStakeReward = onRequest(WEN_FUNC.removeStakeReward)(
  removeStakeRewardSchema,
  removeStakeRewardControl,
);
