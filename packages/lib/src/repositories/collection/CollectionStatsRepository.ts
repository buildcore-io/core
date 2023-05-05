import { Collection, PublicCollections, PublicSubCollections } from '@soonaverse/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class CollectionStatsRepository extends SubCrudRepository<Collection> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.COLLECTION, PublicSubCollections.STATS);
  }
}
