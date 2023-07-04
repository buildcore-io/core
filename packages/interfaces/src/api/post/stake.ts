import { EthAddress, StakeType } from '../../models';

export interface TokenStakeRequest {
  symbol: string;
  weeks: number;
  type: StakeType;
  customMetadata: { [key: string]: unknown };
}

export interface TokenStakeReward {
  startDate: number;
  endDate: number;
  tokenVestingDate: number;
  tokensToDistribute: number;
}

export interface TokenStakeRewardsRequest {
  token: EthAddress;
  items: TokenStakeReward[];
}

export interface TokenStakeRewardsRemoveRequest {
  stakeRewardIds: EthAddress[];
}
