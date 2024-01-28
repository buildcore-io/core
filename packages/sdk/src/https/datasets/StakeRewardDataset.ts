import {
  Build5Request,
  Dataset,
  GetManyAdvancedRequest,
  Opr,
  Proposal,
  StakeReward,
  TokenStakeRewardRequest,
  TokenStakeRewardsRemoveRequest,
  WEN_FUNC,
} from '@build-5/interfaces';
import { DatasetClass } from './Dataset';

/**
 * Stake Reward dataset.
 */
export class StakeRewardDataset<D extends Dataset> extends DatasetClass<D, StakeReward> {
  /**
   * Create stake reward.
   *
   * @param req Use {@link Build5Request} with data based on {@link TokenStakeRewardRequest}
   * @returns
   */
  create = (req: Build5Request<TokenStakeRewardRequest>) =>
    this.sendRequest(WEN_FUNC.stakeReward)<TokenStakeRewardRequest, StakeReward[]>(req);
  /**
   * Remove stake reward.
   *
   * @param req Use {@link Build5Request} with data based on {@link TokenStakeRewardsRemoveRequest}
   * @returns
   */
  remove = (req: Build5Request<TokenStakeRewardsRemoveRequest>) =>
    this.sendRequest(WEN_FUNC.removeStakeReward)<TokenStakeRewardsRemoveRequest, Proposal>(req);

  /**
   * TODO
   *
   * @param token
   * @param startAfter
   * @returns
   */
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
