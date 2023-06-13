import { PublicCollections, TokenDrop } from '@build-5/interfaces';
import { Build5Env } from '../../Config';
import { CrudRepository } from '../CrudRepository';

export class AirdropRepository extends CrudRepository<TokenDrop> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.AIRDROP);
  }
}
