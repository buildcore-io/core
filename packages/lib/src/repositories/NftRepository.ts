import { Nft, PublicCollections } from '@soon/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class NftRepository extends CrudRepository<Nft> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.NFT);
  }
}
