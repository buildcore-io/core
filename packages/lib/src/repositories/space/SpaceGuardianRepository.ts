import { PublicCollections, PublicSubCollections, SpaceMember } from '@soonaverse/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class SpaceGuardianRepository extends SubCrudRepository<SpaceMember> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.SPACE, PublicSubCollections.MEMBERS);
  }
}
