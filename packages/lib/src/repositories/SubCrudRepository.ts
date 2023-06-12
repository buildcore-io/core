import {
  GetManyAdvancedRequest,
  Opr,
  PublicCollections,
  PublicSubCollections,
} from '@build5/interfaces';
import { Observable, map } from 'rxjs';
import {
  SESSION_ID,
  SoonEnv,
  getByIdUrl,
  getManyAdvancedUrl,
  getManyUrl,
  getUpdatedAfterUrl,
} from '../Config';
import { toQueryParams, wrappedFetch } from '../fetch.utils';
import { SoonObservable } from '../soon_observable';
import { processObject, processObjectArray } from '../utils';

export abstract class SubCrudRepository<T> {
  constructor(
    protected readonly env: SoonEnv,
    protected readonly col: PublicCollections,
    protected readonly subCol: PublicSubCollections,
  ) {}

  /**
   * Returns entity in the sub collection
   * @param parent - Parrent entity id
   * @param uid - Entity id
   * @returns
   */
  public getById = async (parent: string, uid: string) => {
    const params = { collection: this.col, parentUid: parent, subCollection: this.subCol, uid };
    const result = await wrappedFetch<T>(getByIdUrl(this.env), params);
    const keys = Object.keys(result as Record<string, unknown>);
    return keys.length ? processObject<T>(result) : undefined;
  };

  /**
   * Returns entity in the sub collection as Observable
   * @param parent - Parrent entity id
   * @param uid - Entity id
   * @returns
   */
  public getByIdLive = (parent: string, uid: string): Observable<T | undefined> => {
    const params = {
      collection: this.col,
      parentUid: parent,
      subCollection: this.subCol,
      uid,
      sessionId: SESSION_ID,
    };
    const url = getByIdUrl(this.env) + toQueryParams(params);
    const observable = new SoonObservable<T>(this.env, url);
    return observable.pipe(
      map((result) => {
        const keys = Object.keys(result as Record<string, unknown>);
        return keys.length ? result : undefined;
      }),
    );
  };

  /**
   * Gets all documents paginated for the given sub collection
   * @param parent
   * @param startAfter
   * @returns
   */
  public getAll = async (parent: string, startAfter?: string) => {
    const params = { collection: this.col, uid: parent, subCollection: this.subCol, startAfter };
    const result = await wrappedFetch<T[]>(getManyUrl(this.env), params);
    return processObjectArray<T>(result);
  };

  public getAllLive = (parent: string, startAfter?: string) => {
    const params = {
      collection: this.col,
      uid: parent,
      subCollection: this.subCol,
      startAfter,
      fieldName: [],
      fieldValue: [],
      operator: [],
    };
    return this.getManyAdvancedLive(params);
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
    const result = await wrappedFetch<T[]>(getManyUrl(this.env), params);
    return processObjectArray<T>(result);
  };

  /**
   * Returns entities updated after the given time
   * @param updatedAfter - Unix seconds
   * @returns
   */
  public getAllUpdatedAfter = async (parent: string, updatedAfter: number) => {
    const params = { collection: this.col, uid: parent, subCollection: this.subCol, updatedAfter };
    const result = await wrappedFetch<T[]>(getUpdatedAfterUrl(this.env), params);
    return processObjectArray<T>(result);
  };

  public getTopBySubColIdLive = (
    uid: string,
    orderBy = ['createdOn'],
    orderByDir = ['desc'],
    startAfter?: string,
    limit?: number,
  ) => {
    const params = {
      collection: this.col,
      subCollection: this.subCol,
      fieldName: ['uid', 'parentCol'],
      fieldValue: [uid, this.col],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
      limit,
      orderBy,
      orderByDir,
    };
    return this.getManyAdvancedLive(params);
  };

  protected getManyAdvancedLive = (params: GetManyAdvancedRequest): Observable<T[]> => {
    const url = getManyAdvancedUrl(this.env) + toQueryParams({ ...params, sessionId: SESSION_ID });
    return new SoonObservable<T[]>(this.env, url);
  };
}
