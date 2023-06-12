import { CollectionStats, PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class CollectionStatsRepository extends SubCrudRepository<CollectionStats> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.COLLECTION, PublicSubCollections.STATS);
  }
}
