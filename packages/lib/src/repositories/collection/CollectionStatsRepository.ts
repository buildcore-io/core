import { CollectionStats, PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import { Build5Env } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class CollectionStatsRepository extends SubCrudRepository<CollectionStats> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.COLLECTION, PublicSubCollections.STATS);
  }
}
