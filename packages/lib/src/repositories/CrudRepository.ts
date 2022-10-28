import {
  GetByIdRequest,
  GetManyRequest,
  GetUpdatedAfterRequest,
  PublicCollections,
} from '@soon/interfaces';
import axios from 'axios';
import { getUpdatedAfterUrl, getByIdUrl, getByManyUrl, SoonEnv } from '../Config';

export abstract class CrudRepository<T> {
  constructor(protected readonly env: SoonEnv, protected readonly col: PublicCollections) {}

  /**
   * Returns one or more entity by id
   * @param uids
   * @returns List of entities
   */
  public getById = async (uids: string[]) => {
    const data: GetByIdRequest = {
      collection: this.col,
      uids,
    };
    const response = await axios({
      method: 'post',
      url: getByIdUrl(this.env),
      data,
    });
    return response.data as T[];
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
    fieldValue: string | number | boolean | Date,
    startAfter?: string,
  ) => {
    const data: GetManyRequest = {
      collection: this.col,
      fieldName,
      fieldValue,
      startAfter,
    };
    const response = await axios({
      method: 'post',
      url: getByManyUrl(this.env),
      data,
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
    const data: GetManyRequest = {
      collection: this.col,
      fieldName: 'space',
      fieldValue: space,
      startAfter,
    };
    const response = await axios({
      method: 'post',
      url: getByManyUrl(this.env),
      data,
    });
    return response.data as T[];
  };

  /**
   * Returns entities updated after the given time
   * @param updatedAfter
   * @returns
   */
  public getAllUpdatedAfter = async (updatedAfter: string | Date | number) => {
    const data: GetUpdatedAfterRequest = {
      collection: this.col,
      updatedAfter,
    };
    const response = await axios({
      method: 'post',
      url: getUpdatedAfterUrl(this.env),
      data,
    });
    return response.data as T[];
  };
}
