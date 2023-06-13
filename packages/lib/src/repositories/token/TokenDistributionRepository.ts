import { PublicCollections, PublicSubCollections, TokenDistribution } from '@build-5/interfaces';
import { Build5Env } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class TokenDistributionRepository extends SubCrudRepository<TokenDistribution> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.TOKEN, PublicSubCollections.DISTRIBUTION);
  }
}
