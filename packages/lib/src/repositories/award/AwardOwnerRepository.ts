import { AwardOwner, PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import { Build5Env } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class AwardOwnerRepository extends SubCrudRepository<AwardOwner> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.AWARD, PublicSubCollections.OWNERS);
  }
}
