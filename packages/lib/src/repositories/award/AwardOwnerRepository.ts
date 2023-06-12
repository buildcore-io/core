import { AwardOwner, PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class AwardOwnerRepository extends SubCrudRepository<AwardOwner> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.AWARD, PublicSubCollections.OWNERS);
  }
}
