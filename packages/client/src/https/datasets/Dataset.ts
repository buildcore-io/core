import {
  ApiRoutes,
  Build5Request,
  Dataset,
  GetManyAdvancedRequest,
  GetManyRequest,
  GetUpdatedAfterRequest,
  Opr,
  Subset,
  WEN_FUNC,
} from '@build-5/interfaces';
import axios from 'axios';
import { Observable, from, switchMap } from 'rxjs';
import { Build5 } from '..';
import { toQueryParams, wrappedFetch } from '../fetch.utils';
import GetByIdGrouped from '../get/GetByIdGrouped';
import GetByIdGroupedLive from '../get/GetByIdGroupedLive';
import { fetchLive } from '../get/observable';
import { AwardOwnerSubset } from './award/AwardOwnerSubset';
import { AwardParticpateSubset } from './award/AwardParticipantSubset';
import { CollectionStatsSubset } from './collection/CollectionStatsSubset';
import { SubsetType } from './common';
import { MilestoneTransactionSubset } from './milestone/MilestoneTransactionSubset';
import { SpaceBlockedMemberSubset } from './space/SpaceBlockedMemberSubset';
import { SpaceGuardianSubset } from './space/SpaceGuardianSubset';
import { SpaceKnockingMemberSubset } from './space/SpaceKnockingMemberSubset';
import { SpaceMemberSubset } from './space/SpaceMemberSubset';
import { TokenDistributionSubset } from './token/TokenDistributionSubset';
import { TokenStatsSubset } from './token/TokenStatsSubset';

export abstract class BaseSet<T> {
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

abstract class BaseDataSetClass<T> extends BaseSet<T> {
  protected sendRequest =
    (name: WEN_FUNC) =>
    async <Req, Res>(request: Build5Request<Req>) => {
      const isLocal = this.origin === Build5.LOCAL;
      const url = this.origin + `/${isLocal ? 'https-' : ''}` + name;

      try {
        return (await axios.post(url, { ...request, projectApiKey: this.apiKey })).data as Res;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        throw error.response.data;
      }
    };
}

export abstract class DatasetClass<D extends Dataset, T> extends BaseDataSetClass<T> {
  getManyById = (setIds: string[]) =>
    wrappedFetch<T[]>(this.apiKey, this.origin + ApiRoutes.GET_MANY_BY_ID, {
      dataset: this.dataset,
      setIds,
    });

  getManyByIdLive = (setIds: string[]): Observable<T[]> => {
    const params = { dataset: this.dataset, setIds };
    const url = this.origin + ApiRoutes.GET_MANY_BY_ID + toQueryParams({ ...params });
    return fetchLive<T[]>(this.origin, this.apiKey, url);
  };

  getByField = async (
    fieldName: string | string[],
    fieldValue: string | number | boolean | (string | number | boolean)[],
    startAfter?: string,
  ) => {
    const params = { dataset: this.dataset, fieldName, fieldValue, startAfter };
    return await wrappedFetch<T[]>(this.apiKey, this.origin + ApiRoutes.GET_MANY, params);
  };

  getByFieldLive = (
    fieldName: string | string[],
    fieldValue: string | number | boolean | (string | number | boolean)[],
    startAfter?: string,
  ): Observable<T[]> => {
    const params: GetManyRequest = { dataset: this.dataset, fieldName, fieldValue, startAfter };
    const url = this.origin + ApiRoutes.GET_MANY + toQueryParams({ ...params });
    return fetchLive<T[]>(this.origin, this.apiKey, url);
  };

  getBySpace = async (space: string, startAfter?: string) => {
    const params: GetManyRequest = {
      dataset: this.dataset,
      fieldName: 'space',
      fieldValue: space,
      startAfter,
    };
    const url = this.origin + ApiRoutes.GET_MANY;
    return await wrappedFetch<T[]>(this.apiKey, url, { ...params });
  };

  getBySpaceLive = (space: string, startAfter?: string) => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: ['space'],
      fieldValue: [space],
      operator: [Opr.EQUAL],
      startAfter,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  getAllUpdatedAfter = async (updatedAfter: number, startAfter?: string) => {
    const params: GetUpdatedAfterRequest = { dataset: this.dataset, updatedAfter, startAfter };
    const url = this.origin + ApiRoutes.GET_UPDATED_AFTER;
    return await wrappedFetch<T[]>(this.apiKey, url, { ...params });
  };

  getAllUpdatedAfterLive = (updatedAfter: number, startAfter?: string): Observable<T[]> => {
    const params: GetUpdatedAfterRequest = { dataset: this.dataset, updatedAfter, startAfter };
    const url = this.origin + ApiRoutes.GET_UPDATED_AFTER + toQueryParams({ ...params });
    return fetchLive<T[]>(this.origin, this.apiKey, url);
  };

  getTopLive = (startAfter?: string, limit?: number): Observable<T[]> => {
    const params: GetManyAdvancedRequest = {
      dataset: this.dataset,
      fieldName: [],
      fieldValue: [],
      operator: [],
      startAfter,
      limit,
      orderBy: ['createdOn'],
      orderByDir: ['desc'],
    };
    return this.getManyAdvancedLive(params);
  };

  id = (setId: string) => new ExactDataSet<D, T>(this.origin, this.apiKey, this.dataset, setId);

  subset = <S extends Subset>(subset: S) =>
    new ExactDataSet<D, T>(this.origin, this.apiKey, this.dataset, '').subset(subset);
}

export class ExactDataSet<D extends Dataset, T> extends BaseSet<T> {
  constructor(
    origin: Build5,
    apiKey: string,
    dataset: Dataset,
    private readonly setId: string,
  ) {
    super(origin, apiKey, dataset);
  }
  get = () =>
    GetByIdGrouped.get<T>({
      origin: this.origin,
      dataset: this.dataset,
      setId: this.setId,
      apiKey: this.apiKey,
    });

  getLive = () =>
    from(
      GetByIdGroupedLive.get<T>({
        origin: this.origin,
        dataset: this.dataset,
        setId: this.setId,
        apiKey: this.apiKey,
      }),
    ).pipe(switchMap((inner) => inner));

  subset = <S extends Subset>(subset: S): SubsetType<D, S> => {
    switch (subset) {
      case Subset.PARTICIPANTS:
        return new AwardParticpateSubset(
          this.origin,
          this.apiKey,
          this.dataset,
          this.setId,
          Subset.PARTICIPANTS,
        ) as SubsetType<D, S>;
      case Subset.OWNERS:
        return new AwardOwnerSubset(
          this.origin,
          this.apiKey,
          this.dataset,
          this.setId,
          Subset.OWNERS,
        ) as SubsetType<D, S>;
      case Subset.STATS: {
        if (this.dataset === Dataset.TOKEN) {
          return new TokenStatsSubset(
            this.origin,
            this.apiKey,
            this.dataset,
            this.setId,
            Subset.STATS,
          ) as SubsetType<D, S>;
        }
        if (this.dataset === Dataset.COLLECTION) {
          return new CollectionStatsSubset(
            this.origin,
            this.apiKey,
            this.dataset,
            this.setId,
            Subset.STATS,
          ) as SubsetType<D, S>;
        }
        throw Error('invalid subset name');
      }
      case Subset.MEMBERS:
        return new SpaceMemberSubset(
          this.origin,
          this.apiKey,
          this.dataset,
          this.setId,
          Subset.MEMBERS,
        ) as SubsetType<D, S>;
      case Subset.GUARDIANS:
        return new SpaceGuardianSubset(
          this.origin,
          this.apiKey,
          this.dataset,
          this.setId,
          Subset.GUARDIANS,
        ) as SubsetType<D, S>;
      case Subset.KNOCKING_MEMBERS:
        return new SpaceKnockingMemberSubset(
          this.origin,
          this.apiKey,
          this.dataset,
          this.setId,
          Subset.KNOCKING_MEMBERS,
        ) as SubsetType<D, S>;
      case Subset.BLOCKED_MEMBERS:
        return new SpaceBlockedMemberSubset(
          this.origin,
          this.apiKey,
          this.dataset,
          this.setId,
          Subset.BLOCKED_MEMBERS,
        ) as SubsetType<D, S>;
      case Subset.DISTRIBUTION:
        return new TokenDistributionSubset(
          this.origin,
          this.apiKey,
          this.dataset,
          this.setId,
          Subset.DISTRIBUTION,
        ) as SubsetType<D, S>;
      case Subset.TRANSACTIONS:
        return new MilestoneTransactionSubset(
          this.origin,
          this.apiKey,
          this.dataset,
          this.setId,
          Subset.TRANSACTIONS,
        ) as SubsetType<D, S>;
      default:
        throw Error('invalid subset name');
    }
  };
}
