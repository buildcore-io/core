import {
  GetByIdRequest,
  GetManyRequest,
  GetUpdatedAfterRequest,
  PublicCollections,
  PublicSubCollections,
} from '@soon/interfaces';
import axios from 'axios';
import { getByIdUrl, getByManyUrl, getUpdatedAfterUrl, SoonEnv } from '../Config';

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
    const params: GetByIdRequest = {
      collection: this.col,
      parentUid: parent,
      subCollection: this.subCol,
      uid,
    };
    const response = await axios({
      method: 'get',
      url: getByIdUrl(this.env),
      params,
    });
    return response.data as T;
  };

  /**
   * Gets all documents paginated for the given sub collection
   * @param parent
   * @param startAfter
   * @returns
   */
  public getAll = async (parent: string, startAfter?: string) => {
    const params: GetManyRequest = {
      collection: this.col,
      uid: parent,
      subCollection: this.subCol,
      startAfter
    };
    const response = await axios({
      method: 'get',
      url: getByManyUrl(this.env),
      params,
    });
    return response.data as T[];
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
    const params: GetManyRequest = {
      collection: this.col,
      uid: parent,
      subCollection: this.subCol,
      fieldName,
      fieldValue,
      startAfter,
    };
    const response = await axios({
      method: 'get',
      url: getByManyUrl(this.env),
      params,
    });
    return response.data as T[];
  };

  /**
   * Returns entities updated after the given time
   * @param updatedAfter
   * @returns
   */
  public getAllUpdatedAfter = async (parent: string, updatedAfter: string | Date | number) => {
    const params: GetUpdatedAfterRequest = {
      collection: this.col,
      uid: parent,
      subCollection: this.subCol,
      updatedAfter,
    };
    const response = await axios({
      method: 'get',
      url: getUpdatedAfterUrl(this.env),
      params,
    });
    return response.data as T[];
  };
}
