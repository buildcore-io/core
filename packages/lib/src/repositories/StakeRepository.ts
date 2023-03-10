import { PublicCollections, Stake } from '@soonaverse/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class StakeRepository extends CrudRepository<Stake> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.STAKE);
  }
}
