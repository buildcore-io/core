import {
  GetManyAdvancedRequest,
  GetManyByIdRequest,
  Opr,
  PublicCollections,
} from '@build-5/interfaces';
import { Observable as RxjsObservable, map } from 'rxjs';
import {
  Build5Env,
  SESSION_ID,
  getByIdUrl,
  getManyAdvancedUrl,
  getManyByIdUrl,
  getManyUrl,
  getUpdatedAfterUrl,
} from '../Config';
import { toQueryParams, wrappedFetch } from '../fetch.utils';
import { Observable } from '../observable';
import { processObject, processObjectArray } from '../utils';

export class CrudRepository<T> {
  constructor(protected readonly env: Build5Env, protected readonly col: PublicCollections) {}

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

  public getManyById = async (uids: string[]) => {
    const params: GetManyByIdRequest = { collection: this.col, uids };
    const result = await wrappedFetch<T[]>(getManyByIdUrl(this.env), { ...params });
    return processObjectArray<T>(result);
  };

  /**
   * Returns one entity by id
   * @param uid
   * @returns Observable with the entity
   */
  public getByIdLive = (uid: string): RxjsObservable<T | undefined> => {
    const params = { collection: this.col, uid, sessionId: SESSION_ID };
    const url = getByIdUrl(this.env) + toQueryParams(params);
    const observable = new Observable<T>(this.env, url);
    return observable.pipe(
      map((result) => {
        const keys = Object.keys(result as Record<string, unknown>);
        return keys.length ? result : undefined;
      }),
    );
  };

  public getManyByIdLive = (uids: string[]): RxjsObservable<T[]> => {
    const params: GetManyByIdRequest = { collection: this.col, uids, sessionId: SESSION_ID };
    const url = getManyByIdUrl(this.env) + toQueryParams({ ...params });
    return new Observable<T[]>(this.env, url);
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
    const params = {
      collection: this.col,
      fieldName,
      fieldValue,
      startAfter,
      sessionId: SESSION_ID,
    };
    const url = getManyUrl(this.env) + toQueryParams(params);
    return new Observable<T[]>(this.env, url);
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
    const params = { collection: this.col, updatedAfter, startAfter, sessionId: SESSION_ID };
    const url = getUpdatedAfterUrl(this.env) + toQueryParams(params);
    return new Observable<T[]>(this.env, url);
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
    return this.getManyAdvancedLive(params);
  };

  protected getManyAdvancedLive = (params: GetManyAdvancedRequest): Observable<T[]> => {
    const url = getManyAdvancedUrl(this.env) + toQueryParams({ ...params, sessionId: SESSION_ID });
    return new Observable<T[]>(this.env, url);
  };
}
