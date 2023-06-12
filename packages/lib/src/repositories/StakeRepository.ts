import { Opr, PublicCollections, Stake } from '@build-5/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class StakeRepository extends CrudRepository<Stake> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.STAKE);
  }

  public getByMemberLive = (member: string, startAfter?: string, limit?: number) => {
    const params = {
      collection: this.col,
      fieldName: ['member'],
      fieldValue: [member],
      operator: [Opr.EQUAL],
      startAfter,
      limit,
      orderBy: ['expiresAt'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
