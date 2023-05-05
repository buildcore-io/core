import {
  GetManyAdvancedRequest,
  Opr,
  PublicCollections,
  PublicSubCollections,
} from '@soonaverse/interfaces';
import {
  SoonEnv,
  getByIdUrl,
  getByManyUrl,
  getManyAdvancedUrl,
  getUpdatedAfterUrl,
} from '../Config';
import { toQueryParams, wrappedFetch } from '../fetch.utils';
import { SoonObservable } from '../sonn_observable';

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
    return await wrappedFetch<T>(getByIdUrl(this.env), params);
  };

  /**
   * Returns entity in the sub collection as Observable
   * @param parent - Parrent entity id
   * @param uid - Entity id
   * @returns
   */
  public getByIdLive = (uid: string) => {
    const params = { collection: this.col, uid, live: true };
    const url = getByIdUrl(this.env) + toQueryParams(params);
    return new SoonObservable<T>(this.env, url);
  };

  /**
   * Gets all documents paginated for the given sub collection
   * @param parent
   * @param startAfter
   * @returns
   */
  public getAll = async (parent: string, startAfter?: string) => {
    const params = { collection: this.col, uid: parent, subCollection: this.subCol, startAfter };
    return await wrappedFetch<T[]>(getByManyUrl(this.env), params);
  };

  public getAllLive = async (parent: string, startAfter?: string) => {
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
    return await wrappedFetch<T[]>(getByManyUrl(this.env), params);
  };

  /**
   * Returns entities updated after the given time
   * @param updatedAfter - Unix seconds
   * @returns
   */
  public getAllUpdatedAfter = async (parent: string, updatedAfter: number) => {
    const params = { collection: this.col, uid: parent, subCollection: this.subCol, updatedAfter };
    return await wrappedFetch<T[]>(getUpdatedAfterUrl(this.env), params);
  };

  public getTopBySubColIdLive = (uid: string, startAfter?: string) => {
    const params = {
      collection: this.col,
      subCollection: this.subCol,
      fieldName: ['uid', 'parentCol'],
      fieldValue: [uid, this.col],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  protected getManyAdvancedLive = (params: GetManyAdvancedRequest) => {
    const url = getManyAdvancedUrl(this.env) + toQueryParams({ ...params });
    return new SoonObservable<T[]>(this.env, url);
  };
}
