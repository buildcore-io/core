import { TokenStakeRewardsRemoveRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

const MIN_COUNT = 1;
const MAX_COUNT = 450;
export const removeStakeRewardSchema = toJoiObject<TokenStakeRewardsRemoveRequest>({
  stakeRewardIds: Joi.array()
    .items(CommonJoi.uid())
    .min(MIN_COUNT)
    .max(MAX_COUNT)
    .required()
    .description('Buildcore ids of the rewards to be removed'),
})
  .description('Request object to remove a stake reward(s).')
  .meta({
    className: 'TokenStakeRewardsRemoveRequest',
  });
