import { PublicCollections, TokenDrop } from '@soonaverse/interfaces';
import { SoonEnv } from '../../Config';
import { CrudRepository } from '../CrudRepository';

export class AirdropRepository extends CrudRepository<TokenDrop> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.AIRDROP);
  }
}
