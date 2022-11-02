import { PublicCollections, TokenPurchase } from '@soonaverse/interfaces';
import { SoonEnv } from '../../Config';
import { CrudRepository } from '../CrudRepository';

export class TokenPurchaseRepository extends CrudRepository<TokenPurchase> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.TOKEN_PURCHASE);
  }
}
