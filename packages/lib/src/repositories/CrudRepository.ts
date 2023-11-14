import {
  GetManyAdvancedRequest,
  GetManyByIdRequest,
  Opr,
  PublicCollections,
} from '@build-5/interfaces';
import { Observable, from, switchMap } from 'rxjs';
import {
  Build5Env,
  TOKENS,
  getManyAdvancedUrl,
  getManyByIdUrl,
  getManyUrl,
  getUpdatedAfterUrl,
} from '../Config';
import { toQueryParams, wrappedFetch } from '../fetch.utils';
import { fetchLive } from '../observable';
import { GetByIdGrouped } from './groupGet/GetByIdGrouped';
import { GetByIdGroupedLive } from './groupGet/GetByIdGroupedLive';

export class CrudRepository<T> {
  private readonly getByIdGroupedLive: GetByIdGroupedLive<T>;
  private readonly getByIdGrouped: GetByIdGrouped<T>;

  constructor(
    protected readonly env: Build5Env,
    protected readonly col: PublicCollections,
  ) {
    this.getByIdGroupedLive = new GetByIdGroupedLive<T>(env, col);
    this.getByIdGrouped = new GetByIdGrouped<T>(env, col);
  }

  /**
   * Returns one entity by id
   * @param uid
   * @returns The entity
   */
  public getById = (uid: string) => this.getByIdGrouped.get(uid);

  public getManyById = (uids: string[]) =>
    wrappedFetch<T[]>(TOKENS[this.env], getManyByIdUrl(this.env), { collection: this.col, uids });

  /**
   * Returns one entity by id
   * @param uid
   * @returns Observable with the entity
   */
  public getByIdLive = (uid: string) =>
    from(this.getByIdGroupedLive.get(uid)).pipe(switchMap((inner) => inner));

  public getManyByIdLive = (uids: string[]): Observable<T[]> => {
    const params: GetManyByIdRequest = { collection: this.col, uids };
    const url = getManyByIdUrl(this.env) + toQueryParams({ ...params });
    return fetchLive<T[]>(this.env, url);
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
    return await wrappedFetch<T[]>(TOKENS[this.env], getManyUrl(this.env), params);
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
    return fetchLive<T[]>(this.env, url);
  };

  /**
   * Gets entitites by space id
   * @param space - Space id
   * @param startAfter - The query will start after the given entity id
   * @returns - List of entities
   */
  public getBySpace = async (space: string, startAfter?: string) => {
    const params = { collection: this.col, fieldName: 'space', fieldValue: space, startAfter };
    return await wrappedFetch<T[]>(TOKENS[this.env], getManyUrl(this.env), params);
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
    return await wrappedFetch<T[]>(TOKENS[this.env], getUpdatedAfterUrl(this.env), params);
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
    return fetchLive<T[]>(this.env, url);
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
    const url = getManyAdvancedUrl(this.env) + toQueryParams({ ...params });
    return fetchLive<T[]>(this.env, url);
  };
}
