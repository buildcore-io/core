import { Badge, PublicCollections } from '@build-5/interfaces';
import { Build5Env } from '../Config';
import { CrudRepository } from './CrudRepository';

export class BadgesRepository extends CrudRepository<Badge> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.BADGES);
  }
}
