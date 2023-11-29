import {
  Dataset,
  GetManyAdvancedRequest,
  Opr,
  StakeReward,
  TokenStakeRewardRequest,
  TokenStakeRewardsRemoveRequest,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

export class StakeRewardDataset<D extends Dataset> extends DatasetClass<D, StakeReward> {
  create = this.sendRequest(WEN_FUNC.stakeReward)<TokenStakeRewardRequest>;

  remove = this.sendRequest(WEN_FUNC.removeStakeReward)<TokenStakeRewardsRemoveRequest>;

  getByTokenLive = (token: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['token'],
      fieldValue: [token],
      operator: [Opr.EQUAL],
      startAfter,
      orderBy: ['endDate'],
      orderByDir: ['asc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
