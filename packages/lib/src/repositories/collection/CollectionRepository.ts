import { Collection, Opr, PublicCollections } from '@build5/interfaces';
import { SoonEnv } from '../../Config';
import { CrudRepository } from '../CrudRepository';

export class CollectionRepository extends CrudRepository<Collection> {
  constructor(env?: SoonEnv) {
    super(env || SoonEnv.PROD, PublicCollections.COLLECTION);
  }

  public getAllPendingLive = (space: string, startAfter?: string) => {
    const params = {
      collection: this.col,
      fieldName: ['space', 'approved', 'rejected'],
      fieldValue: [space, false, false],
      operator: [Opr.EQUAL, Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  public getAllAvailableLive = (space: string, startAfter?: string) => {
    const params = {
      collection: this.col,
      fieldName: ['space', 'approved'],
      fieldValue: [space, true],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  public getAllRejectedLive = (space: string, startAfter?: string) => {
    const params = {
      collection: this.col,
      fieldName: ['space', 'rejected'],
      fieldValue: [space, true],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };
}
