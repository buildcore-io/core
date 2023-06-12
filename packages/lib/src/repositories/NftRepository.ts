import { Nft, Opr, PublicCollections } from '@build5/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class NftRepository extends CrudRepository<Nft> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.NFT);
  }

  public getByCollectionLive = (
    collection: string,
    orderBy: string[],
    orderByDir: string[],
    startAfter?: string,
  ) => {
    const params = {
      collection: this.col,
      fieldName: ['hidden', 'collection'],
      fieldValue: [false, collection],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy,
      orderByDir,
    };
    return this.getManyAdvancedLive(params);
  };

  public getByOwnerLive = (owner: string, startAfter?: string) => {
    const params = {
      collection: this.col,
      fieldName: ['hidden', 'owner'],
      fieldValue: [false, owner],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['updatedOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
