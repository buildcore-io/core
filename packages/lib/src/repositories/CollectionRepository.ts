import { Collection, PublicCollections } from '@soonaverse/interfaces';
import { SoonEnv } from '../Config';
import { CrudRepository } from './CrudRepository';

export class CollectionRepository extends CrudRepository<Collection> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.COLLECTION);
  }
}
