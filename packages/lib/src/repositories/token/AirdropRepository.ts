import { PublicCollections, TokenDrop } from '@build5/interfaces';
import { SoonEnv } from '../../Config';
import { CrudRepository } from '../CrudRepository';

export class AirdropRepository extends CrudRepository<TokenDrop> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.AIRDROP);
  }
}
