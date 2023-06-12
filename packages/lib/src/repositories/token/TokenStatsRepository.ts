import { PublicCollections, PublicSubCollections, TokenStats } from '@build5/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class TokenStatsRepository extends SubCrudRepository<TokenStats> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.TOKEN, PublicSubCollections.STATS);
  }
}
