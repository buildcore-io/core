import { PublicCollections, PublicSubCollections, TokenStats } from '@build-5/interfaces';
import { Build5Env } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class TokenStatsRepository extends SubCrudRepository<TokenStats> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.TOKEN, PublicSubCollections.STATS);
  }
}
