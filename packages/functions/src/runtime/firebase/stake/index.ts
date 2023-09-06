import { WEN_FUNC } from '@build-5/interfaces';
import { depositStakeControl } from '../../../controls/stake/stake.deposit';
import { stakeRewardControl } from '../../../controls/stake/stake.reward';
import { removeStakeRewardControl } from '../../../controls/stake/stake.reward.revoke';
import { onRequest } from '../../../firebase/functions/onRequest';
import { removeStakeRewardSchema } from './StakeRewardRemoveRequestSchema';
import { stakeRewardsSchema } from './StakeRewardRequestSchema';
import { depositStakeSchemaObject } from './StakeTokenRequestSchema';

export const depositStake = onRequest(WEN_FUNC.depositStake)(
  depositStakeSchemaObject,
  depositStakeControl,
);

export const stakeReward = onRequest(WEN_FUNC.stakeReward)(stakeRewardsSchema, stakeRewardControl);

export const removeStakeReward = onRequest(WEN_FUNC.removeStakeReward)(
  removeStakeRewardSchema,
  removeStakeRewardControl,
);
