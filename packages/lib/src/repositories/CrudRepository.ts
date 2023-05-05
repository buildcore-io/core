import { GetManyAdvancedRequest, Opr, PublicCollections } from '@soonaverse/interfaces';
import {
  SoonEnv,
  getByIdUrl,
  getByManyUrl,
  getManyAdvancedUrl,
  getUpdatedAfterUrl,
} from '../Config';
import { toQueryParams, wrappedFetch } from '../fetch.utils';
import { SoonObservable } from '../sonn_observable';

export class CrudRepository<T> {
  constructor(protected readonly env: SoonEnv, protected readonly col: PublicCollections) {}

  /**
   * Returns one entity by id
   * @param uid
   * @returns The entity
   */
  public getById = (uid: string) => {
    const params = { collection: this.col, uid };
    return wrappedFetch<T>(getByIdUrl(this.env), params);
  };

  /**
   * Returns one entity by id
   * @param uid
   * @returns Observable with the entity
   */
  public getByIdLive = (uid: string) => {
    const params = { collection: this.col, uid, live: true };
    const url = getByIdUrl(this.env) + toQueryParams(params);
    return new SoonObservable<T>(this.env, url);
  };

  public getManyById = async (uids: string[]) => {
    const promises = uids.map(this.getById);
    return await Promise.all(promises);
  };

  public getManyByIdLive = (uids: string[]) => uids.map(this.getByIdLive);

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
   * Returns observable with entities where the given field matches the given field value
   * @param fieldName
   * @param fieldValue
   * @param startAfter
   * @returns
   */
  public getByFieldLive = (
    fieldName: string | string[],
    fieldValue: string | number | boolean | (string | number | boolean)[],
    startAfter?: string,
  ) => {
    const params = { collection: this.col, fieldName, fieldValue, startAfter };
    const url = getByIdUrl(this.env) + toQueryParams(params);
    return new SoonObservable<T>(this.env, url);
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
   * @param space - Space id
   * @param startAfter - The query will start after the given entity id
   * @returns - Observable with list of entities
   */
  public getBySpaceLive = (space: string, startAfter?: string) => {
    const params = {
      collection: this.col,
      fieldName: ['space'],
      fieldValue: [space],
      operator: [Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
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

  /**
   * Returns observable with entities updated after the given time
   * @param updatedAfter - Unix seconds
   * @param startAfter - The query will start after the given entity id
   * @returns
   */
  public getAllUpdatedAfterLive = (updatedAfter: number, startAfter?: string) => {
    const params = { collection: this.col, updatedAfter, startAfter };
    const url = getUpdatedAfterUrl(this.env) + toQueryParams(params);
    return new SoonObservable<T[]>(this.env, url);
  };

  protected getManyAdvancedLive = (params: GetManyAdvancedRequest) => {
    const url = getManyAdvancedUrl(this.env) + toQueryParams({ ...params });
    return new SoonObservable<T[]>(this.env, url);
  };
}
