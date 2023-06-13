import { Collection, Opr, PublicCollections } from '@build-5/interfaces';
import { Build5Env } from '../../Config';
import { CrudRepository } from '../CrudRepository';

export class CollectionRepository extends CrudRepository<Collection> {
  constructor(env?: Build5Env) {
    super(env || Build5Env.PROD, PublicCollections.COLLECTION);
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
