import { PublicCollections } from '@soonaverse/interfaces';
import { getByIdUrl, getByManyUrl, getUpdatedAfterUrl, SoonEnv } from '../Config';
import { wrappedFetch } from '../fetch.utils';

export abstract class CrudRepository<T> {
  constructor(protected readonly env: SoonEnv, protected readonly col: PublicCollections) {}

  /**
   * Returns one or more entity by id
   * @param uid
   * @returns List of entities
   */
  public getById = async (uid: string) => {
    const params = { collection: this.col, uid };
    return await wrappedFetch<T>(getByIdUrl(this.env), params);
  };

  /**
   * Returns entities where the given field matches the given field value
   * @param fieldName
   * @param fieldValue
   * @param startAfter
   * @returns
   */
  public getByField = async (
    fieldName: string | string[],
    fieldValue: string | number | boolean | (string | number | boolean)[],
    startAfter?: string,
  ) => {
    const params = { collection: this.col, fieldName, fieldValue, startAfter };
    return await wrappedFetch<T[]>(getByManyUrl(this.env), params);
  };

  /**
   * Gets entitites by space id
   * @param space - Space id
   * @param startAfter - The query will start after the given entity id
   * @returns - List of entities
   */
  public getBySpace = async (space: string, startAfter?: string) => {
    const params = { collection: this.col, fieldName: 'space', fieldValue: space, startAfter };
    return await wrappedFetch<T[]>(getByManyUrl(this.env), params);
  };

  /**
   * Returns entities updated after the given time
   * @param updatedAfter - Unix seconds
   * @param startAfter - The query will start after the given entity id
   * @returns
   */
  public getAllUpdatedAfter = async (updatedAfter: number, startAfter?: string) => {
    const params = { collection: this.col, updatedAfter, startAfter };
    return await wrappedFetch<T[]>(getUpdatedAfterUrl(this.env), params);
  };
}
