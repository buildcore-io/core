import {
  ApiRoutes,
  Dataset,
  GetManyAdvancedRequest,
  GetManyByIdRequest,
  GetManyRequest,
  GetUpdatedAfterRequest,
  Opr,
  Subset,
} from '@build-5/interfaces';
import { Observable, from, switchMap } from 'rxjs';
import { Build5 } from '..';
import { toQueryParams, wrappedFetch } from '../fetch.utils';
import GetByIdGrouped from '../get/GetByIdGrouped';
import GetByIdGroupedLive from '../get/GetByIdGroupedLive';
import { fetchLive } from '../get/observable';

export abstract class BaseSubset<T> {
  constructor(
    protected readonly origin: Build5,
    protected readonly apiKey: string,
    protected readonly dataset: Dataset,
  ) {}

  protected getManyAdvancedLive = (params: GetManyAdvancedRequest): Observable<T[]> => {
    const url = this.origin + ApiRoutes.GET_MANY_ADVANCED + toQueryParams({ ...params });
    return fetchLive<T[]>(this.origin, this.apiKey, url);
  };
}

export class SubsetClass<T> extends BaseSubset<T> {
  constructor(
    origin: Build5,
    apiKey: string,
    dataset: Dataset,
    protected readonly setId: string,
    protected readonly subset: Subset,
  ) {
    super(origin, apiKey, dataset);
  }

  getManyById = async (subsetIds: string[]) => {
    const params: GetManyByIdRequest = {
      dataset: this.dataset,
      setIds: subsetIds.map(() => this.setId),
      subset: this.subset,
      subsetIds,
    };
    const url = this.origin + ApiRoutes.GET_MANY_BY_ID;
    return await wrappedFetch<T[]>(this.apiKey, url, { ...params });
  };

  getManyByIdLive = (subsetIds: string[]): Observable<T[]> => {
    const params: GetManyByIdRequest = {
      dataset: this.dataset,
      setIds: subsetIds.map(() => this.setId),
      subset: this.subset,
      subsetIds,
    };
    const url = this.origin + ApiRoutes.GET_MANY_BY_ID + toQueryParams({ ...params });
    return fetchLive<T[]>(this.origin, this.apiKey, url);
  };

  getAll = async (startAfter?: string) => {
    const params: GetManyRequest = {
      dataset: this.dataset,
      setId: this.setId,
      subset: this.subset,
      startAfter,
    };
    const url = this.origin + ApiRoutes.GET_MANY;
    return await wrappedFetch<T[]>(this.apiKey, url, { ...params });
  };

  getAllLive = (startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      setId: this.setId,
      subset: this.subset,
      startAfter,
      fieldName: [],
      fieldValue: [],
      operator: [],
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  getByField = async (
    fieldName: string,
    fieldValue: string | number | boolean,
    startAfter?: string,
  ) => {
    const params: GetManyRequest = {
      dataset: this.dataset,
      setId: this.setId,
      subset: this.subset,
      fieldName,
      fieldValue,
      startAfter,
    };
    const url = this.origin + ApiRoutes.GET_MANY;
    return await wrappedFetch<T[]>(this.apiKey, url, { ...params });
  };

  getAllUpdatedAfter = async (updatedAfter: number) => {
    const params: GetUpdatedAfterRequest = {
      dataset: this.dataset,
      setId: this.setId,
      subset: this.subset,
      updatedAfter,
    };
    const url = this.origin + ApiRoutes.GET_UPDATED_AFTER;
    return await wrappedFetch<T[]>(this.apiKey, url, { ...params });
  };

  getTopBySubColIdLive = (
    subsetId: string,
    orderBy = ['createdOn'],
    orderByDir = ['desc'],
    startAfter?: string,
    limit?: number,
  ) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      subset: this.subset,
      fieldName: ['uid', 'parentCol'],
      fieldValue: [subsetId, this.dataset],
      operator: [Opr.EQUAL, Opr.EQUAL],
      startAfter,
      limit,
      orderBy,
      orderByDir,
    };
    return this.getManyAdvancedLive(params);
  };

  subsetId = (subsetId: string) =>
    new ExactSubset<T>(this.origin, this.apiKey, this.dataset, this.setId, this.subset, subsetId);
}

class ExactSubset<T> {
  constructor(
    private readonly origin: Build5,
    private readonly apiKey: string,
    private readonly dataset: Dataset,
    private readonly setId: string,
    private readonly subset: Subset,
    private readonly subsetId: string,
  ) {}

  get = () => {
    if (!this.setId) {
      throw Error('Setid must be set');
    }
    return GetByIdGrouped.get<T>({
      origin: this.origin,
      dataset: this.dataset,
      setId: this.setId,
      subset: this.subset,
      subsetId: this.subsetId,
      apiKey: this.apiKey,
    });
  };

  getLive = () => {
    if (!this.setId) {
      throw Error('Setid must be set');
    }
    return from(
      GetByIdGroupedLive.get<T>({
        origin: this.origin,
        apiKey: this.apiKey,
        dataset: this.dataset,
        setId: this.setId,
        subset: this.subset,
        subsetId: this.subsetId,
      }),
    ).pipe(switchMap((inner) => inner));
  };
}
