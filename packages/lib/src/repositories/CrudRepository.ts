import { GetManyAdvancedRequest, Opr, PublicCollections } from '@soonaverse/interfaces';
import { Observable, combineLatest, map } from 'rxjs';
import { SoonEnv, getByIdUrl, getManyAdvancedUrl, getManyUrl, getUpdatedAfterUrl } from '../Config';
import { toQueryParams, wrappedFetch } from '../fetch.utils';
import { SoonObservable } from '../soon_observable';
import { processObject, processObjectArray } from '../utils';

export class CrudRepository<T> {
  constructor(protected readonly env: SoonEnv, protected readonly col: PublicCollections) {}

  /**
   * Returns one entity by id
   * @param uid
   * @returns The entity
   */
  public getById = async (uid: string) => {
    const params = { collection: this.col, uid };
    const result = await wrappedFetch<T>(getByIdUrl(this.env), params);
    const keys = Object.keys(result as Record<string, unknown>);
    return keys.length ? processObject<T>(result) : undefined;
  };

  /**
   * Returns one entity by id
   * @param uid
   * @returns Observable with the entity
   */
  public getByIdLive = (uid: string): Observable<T | undefined> => {
    const params = { collection: this.col, uid, live: true };
    const url = getByIdUrl(this.env) + toQueryParams(params);
    const observable = new SoonObservable<T>(this.env, url);
    return observable.pipe(
      map((result) => {
        const keys = Object.keys(result as Record<string, unknown>);
        return keys.length ? result : undefined;
      }),
    );
  };

  public getManyById = async (uids: string[]) => {
    const promises = uids.map(this.getById);
    return await Promise.all(promises);
  };

  public getManyByIdLive = (uids: string[]): Observable<T[]> => {
    const streams = uids.map(this.getByIdLive);
    return combineLatest(streams).pipe(map((objects) => objects.filter((o) => !!o).map((o) => o!)));
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
    const result = await wrappedFetch<T[]>(getManyUrl(this.env), params);
    return processObjectArray<T>(result);
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
  ): Observable<T[]> => {
    const params = { collection: this.col, fieldName, fieldValue, startAfter };
    const url = getManyUrl(this.env) + toQueryParams(params);
    return new SoonObservable<T[]>(this.env, url);
  };

  /**
   * Gets entitites by space id
   * @param space - Space id
   * @param startAfter - The query will start after the given entity id
   * @returns - List of entities
   */
  public getBySpace = async (space: string, startAfter?: string) => {
    const params = { collection: this.col, fieldName: 'space', fieldValue: space, startAfter };
    const result = await wrappedFetch<T[]>(getManyUrl(this.env), params);
    return processObjectArray<T>(result);
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
    const result = await wrappedFetch<T[]>(getUpdatedAfterUrl(this.env), params);
    return processObjectArray<T>(result);
  };

  /**
   * Returns observable with entities updated after the given time
   * @param updatedAfter - Unix seconds
   * @param startAfter - The query will start after the given entity id
   * @returns
   */
  public getAllUpdatedAfterLive = (updatedAfter: number, startAfter?: string): Observable<T[]> => {
    const params = { collection: this.col, updatedAfter, startAfter };
    const url = getUpdatedAfterUrl(this.env) + toQueryParams(params);
    return new SoonObservable<T[]>(this.env, url);
  };

  public getTopLive = (startAfter?: string, limit?: number): Observable<T[]> => {
    const params = {
      collection: this.col,
      fieldName: [],
      fieldValue: [],
      operator: [],
      startAfter,
      limit,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    } as GetManyAdvancedRequest;
    const url = getManyAdvancedUrl(this.env) + toQueryParams({ ...params });
    return new SoonObservable<T[]>(this.env, url);
  };

  protected getManyAdvancedLive = (params: GetManyAdvancedRequest): Observable<T[]> => {
    const url = getManyAdvancedUrl(this.env) + toQueryParams({ ...params, live: true });
    return new SoonObservable<T[]>(this.env, url);
  };
}
