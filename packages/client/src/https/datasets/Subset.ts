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
import { toQueryParams, wrappedFetch } from '../fetch.utils';
import GetByIdGrouped from '../get/GetByIdGrouped';
import GetByIdGroupedLive from '../get/GetByIdGroupedLive';
import { fetchLive } from '../get/observable';
import { API_KEY, Build5 } from '..';

export abstract class BaseSubset<T> {
  protected token: string;
  constructor(
    protected readonly origin: Build5,
    protected readonly dataset: Dataset,
  ) {
    this.token = API_KEY[this.origin];
  }

  protected getManyAdvancedLive = (params: GetManyAdvancedRequest): Observable<T[]> => {
    const url = this.origin + ApiRoutes.GET_MANY_ADVANCED + toQueryParams({ ...params });
    return fetchLive<T[]>(this.origin, url);
  };
}

export class SubsetClass<T> extends BaseSubset<T> {
  constructor(
    origin: Build5,
    dataset: Dataset,
    protected readonly setId: string,
    protected readonly subset: Subset,
  ) {
    super(origin, dataset);
  }

  getManyById = async (subsetIds: string[]) => {
    const params: GetManyByIdRequest = {
      dataset: this.dataset,
      setIds: subsetIds.map(() => this.setId),
      subset: this.subset,
      subsetIds,
    };
    const url = this.origin + ApiRoutes.GET_MANY_BY_ID;
    return await wrappedFetch<T[]>(this.token, url, { ...params });
  };

  getManyByIdLive = (subsetIds: string[]): Observable<T[]> => {
    const params: GetManyByIdRequest = {
      dataset: this.dataset,
      setIds: subsetIds.map(() => this.setId),
      subset: this.subset,
      subsetIds,
    };
    const url = this.origin + ApiRoutes.GET_MANY_BY_ID + toQueryParams({ ...params });
    return fetchLive<T[]>(this.origin, url);
  };

  getAll = async (startAfter?: string) => {
    const params: GetManyRequest = {
      dataset: this.dataset,
      setId: this.setId,
      subset: this.subset,
      startAfter,
    };
    const url = this.origin + ApiRoutes.GET_MANY;
    return await wrappedFetch<T[]>(this.token, url, { ...params });
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
    return await wrappedFetch<T[]>(this.token, url, { ...params });
  };

  getAllUpdatedAfter = async (updatedAfter: number) => {
    const params: GetUpdatedAfterRequest = {
      dataset: this.dataset,
      setId: this.setId,
      subset: this.subset,
      updatedAfter,
    };
    const url = this.origin + ApiRoutes.GET_UPDATED_AFTER;
    return await wrappedFetch<T[]>(this.token, url, { ...params });
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
    new ExactSubset<T>(this.origin, this.dataset, this.setId, this.subset, subsetId);
}

class ExactSubset<T> {
  constructor(
    private readonly origin: Build5,
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
    });
  };

  getLive = () => {
    if (!this.setId) {
      throw Error('Setid must be set');
    }
    return from(
      GetByIdGroupedLive.get({
        origin: this.origin,
        dataset: this.dataset,
        setId: this.setId,
        subset: this.subset,
        subsetId: this.subsetId,
      }),
    ).pipe(switchMap((inner) => inner));
  };
}
