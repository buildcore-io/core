import { PublicCollections, PublicSubCollections, TokenDistribution } from '@soonaverse/interfaces';
import { SoonEnv } from '../../Config';
import { SubCrudRepository } from '../SubCrudRepository';

export class TokenDistributionRepository extends SubCrudRepository<TokenDistribution> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.TOKEN, PublicSubCollections.DISTRIBUTION);
  }
}
