import { PublicCollections, PublicSubCollections, SpaceMember } from '@build5/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class SpaceKnockingMemberRepository extends SubCrudRepository<SpaceMember> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.SPACE, PublicSubCollections.KNOCKING_MEMBERS);
  }
}
