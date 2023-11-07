import {
  GetManyAdvancedRequest,
  Opr,
  PublicCollections,
  PublicSubCollections,
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

export abstract class SubCrudRepository<T> {
  private readonly getByIdGroupedLive: GetByIdGroupedLive<T>;
  private readonly getByIdGrouped: GetByIdGrouped<T>;

  constructor(
    protected readonly env: Build5Env,
    protected readonly col: PublicCollections,
    protected readonly subCol: PublicSubCollections,
  ) {
    this.getByIdGroupedLive = new GetByIdGroupedLive<T>(env, col, subCol);
    this.getByIdGrouped = new GetByIdGrouped<T>(env, col, subCol);
  }

  /**
   * Returns entity in the sub collection
   * @param parent - Parrent entity id
   * @param uid - Entity id
   * @returns
   */
  public getById = (parent: string, uid: string) => this.getByIdGrouped.get(uid, parent);

  public getManyById = async (uids: string[], parent?: string) => {
    const params = {
      collection: this.col,
      parentUids: uids.map(() => parent),
      subCollection: this.subCol,
      uids,
    };
    return await wrappedFetch<T[]>(TOKENS[this.env], getManyByIdUrl(this.env), params);
  };

  /**
   * Returns entity in the sub collection as Observable
   * @param parent - Parrent entity id
   * @param uid - Entity id
   * @returns
   */
  public getByIdLive = (parent: string, uid: string) =>
    from(this.getByIdGroupedLive.get(uid, parent)).pipe(switchMap((inner) => inner));

  public getManyByIdLive = (uids: string[], parent?: string): Observable<T[]> => {
    const params = {
      collection: this.col,
      parentUids: uids.map(() => parent),
      subCollection: this.subCol,
      uids,
    };
    const url = getManyByIdUrl(this.env) + toQueryParams(params);
    return fetchLive<T[]>(this.env, url);
  };

  /**
   * Gets all documents paginated for the given sub collection
   * @param parent
   * @param startAfter
   * @returns
   */
  public getAll = async (parent: string, startAfter?: string) => {
    const params = { collection: this.col, uid: parent, subCollection: this.subCol, startAfter };
    return await wrappedFetch<T[]>(TOKENS[this.env], getManyUrl(this.env), params);
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
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
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
    return await wrappedFetch<T[]>(TOKENS[this.env], getManyUrl(this.env), params);
  };

  /**
   * Returns entities updated after the given time
   * @param updatedAfter - Unix seconds
   * @returns
   */
  public getAllUpdatedAfter = async (parent: string, updatedAfter: number) => {
    const params = { collection: this.col, uid: parent, subCollection: this.subCol, updatedAfter };
    return await wrappedFetch<T[]>(TOKENS[this.env], getUpdatedAfterUrl(this.env), params);
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
    const url = getManyAdvancedUrl(this.env) + toQueryParams({ ...params });
    return fetchLive<T[]>(this.env, url);
  };
}
