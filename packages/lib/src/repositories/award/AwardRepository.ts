import { Award, PublicCollections } from '@soon/interfaces';
import { SoonEnv } from '../../Config';
import { CrudRepository } from '../CrudRepository';

export class AwardRepository extends CrudRepository<Award> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.AWARD);
  }
}
