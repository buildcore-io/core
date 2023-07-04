import { Member, PublicCollections } from '@build-5/interfaces';
import { Build5Env } from '../Config';
import { CrudRepository } from './CrudRepository';

export class MemberRepository extends CrudRepository<Member> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.MEMBER);
  }
}
