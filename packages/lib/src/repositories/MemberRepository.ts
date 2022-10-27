import { Member, PublicCollections } from '@soon/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class MemberRepository extends CrudRepository<Member> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.MEMBER);
  }
}
