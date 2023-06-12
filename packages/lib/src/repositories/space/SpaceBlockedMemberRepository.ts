import { PublicCollections, PublicSubCollections, SpaceMember } from '@build-5/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class SpaceBlockedMemberRepository extends SubCrudRepository<SpaceMember> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.SPACE, PublicSubCollections.BLOCKED_MEMBERS);
  }
}
