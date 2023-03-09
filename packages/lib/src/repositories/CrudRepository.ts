import {
  GetByIdRequest,
  GetManyRequest,
  GetUpdatedAfterRequest,
  PublicCollections,
} from '@soonaverse/interfaces';
import axios from 'axios';
import { getByIdUrl, getByManyUrl, getUpdatedAfterUrl, SoonEnv } from '../Config';

export abstract class CrudRepository<T> {
  constructor(protected readonly env: SoonEnv, protected readonly col: PublicCollections) {}

  /**
   * Returns one or more entity by id
   * @param uid
   * @returns List of entities
   */
  public getById = async (uid: string) => {
    const params: GetByIdRequest = {
      collection: this.col,
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
   * Returns entities where the given field matches the given field value
   * @param fieldName
   * @param fieldValue
   * @param startAfter
   * @returns
   */
  public getByField = async (
    fieldName: string,
    fieldValue: string | number | boolean | (string | number | boolean)[],
    startAfter?: string,
  ) => {
    const params: GetManyRequest = {
      collection: this.col,
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
   * Gets entitites by space id
   * @param space - Space id
   * @param startAfter - The query will start after the given entity id
   * @returns - List of entities
   */
  public getBySpace = async (space: string, startAfter?: string) => {
    const params: GetManyRequest = {
      collection: this.col,
      fieldName: 'space',
      fieldValue: space,
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
   * @param updatedAfter - Unix seconds
   * @param startAfter - The query will start after the given entity id
   * @returns
   */
  public getAllUpdatedAfter = async (updatedAfter: number, startAfter?: string) => {
    const params: GetUpdatedAfterRequest = {
      collection: this.col,
      updatedAfter,
      startAfter,
    };
    const response = await axios({
      method: 'get',
      url: getUpdatedAfterUrl(this.env),
      params,
    });
    return response.data as T[];
  };
}
