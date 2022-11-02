import { Badge, PublicCollections } from '@soonaverse/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class BadgesRepository extends CrudRepository<Badge> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.BADGES);
  }
}
