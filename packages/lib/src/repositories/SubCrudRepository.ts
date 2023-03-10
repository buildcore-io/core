import { PublicCollections, PublicSubCollections } from '@soonaverse/interfaces';
import { getByIdUrl, getByManyUrl, getUpdatedAfterUrl, SoonEnv } from '../Config';
import { fetch } from '../fetch.utils';

export abstract class SubCrudRepository<T> {
  constructor(
    protected readonly env: SoonEnv,
    protected readonly col: PublicCollections,
    protected readonly subCol: PublicSubCollections,
  ) {}

  /**
   * Returns one or more entity in the sub collection
   * @param parent - Parrent entity id
   * @param uids - Sub collection entity ids
   * @returns
   */
  public getById = async (parent: string, uid: string) => {
    const params = { collection: this.col, parentUid: parent, subCollection: this.subCol, uid };
    return await fetch<T>(getByIdUrl(this.env), params);
  };

  /**
   * Gets all documents paginated for the given sub collection
   * @param parent
   * @param startAfter
   * @returns
   */
  public getAll = async (parent: string, startAfter?: string) => {
    const params = { collection: this.col, uid: parent, subCollection: this.subCol, startAfter };
    return await fetch<T[]>(getByManyUrl(this.env), params);
  };

  /**
   * Returns entities where the given field matches the given field value
   * @param parent
   * @param fieldName
   * @param fieldValue
   * @param startAfter
   * @returns
   */
  public getByField = async (
    parent: string,
    fieldName: string,
    fieldValue: string | number | boolean,
    startAfter?: string,
  ) => {
    const params = {
      collection: this.col,
      uid: parent,
      subCollection: this.subCol,
      fieldName,
      fieldValue,
      startAfter,
    };
    return await fetch<T[]>(getByManyUrl(this.env), params);
  };

  /**
   * Returns entities updated after the given time
   * @param updatedAfter - Unix seconds
   * @returns
   */
  public getAllUpdatedAfter = async (parent: string, updatedAfter: number) => {
    const params = { collection: this.col, uid: parent, subCollection: this.subCol, updatedAfter };
    return await fetch<T[]>(getUpdatedAfterUrl(this.env), params);
  };
}
