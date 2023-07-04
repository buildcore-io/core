import { PublicCollections, PublicSubCollections, SpaceMember } from '@build-5/interfaces';
import { Build5Env } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class SpaceKnockingMemberRepository extends SubCrudRepository<SpaceMember> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.SPACE, PublicSubCollections.KNOCKING_MEMBERS);
  }
}
