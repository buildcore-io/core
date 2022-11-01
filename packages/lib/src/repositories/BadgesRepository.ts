import { Badge, PublicCollections } from '@soon/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class BadgesRepository extends CrudRepository<Badge> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.BADGES);
  }
}