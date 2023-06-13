import { Opr, PublicCollections, StakeReward } from '@build-5/interfaces';
import { Build5Env } from '../Config';
import { CrudRepository } from './CrudRepository';

export class StakeRewardRepository extends CrudRepository<StakeReward> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.STAKE_REWARD);
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
