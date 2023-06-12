import { Opr, PublicCollections, StakeReward } from '@build5/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class StakeRewardRepository extends CrudRepository<StakeReward> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.STAKE_REWARD);
  }

  public getByTokenLive = (token: string, startAfter?: string) => {
    const params = {
      collection: this.col,
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
