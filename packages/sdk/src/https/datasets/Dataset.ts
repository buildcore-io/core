import {
  ApiRoutes,
  BuildcoreRequest,
  Dataset,
  GetManyAdvancedRequest,
  GetManyRequest,
  GetUpdatedAfterRequest,
  Opr,
  Subset,
  WEN_FUNC,
} from '@buildcore/interfaces';
import axios from 'axios';
import { Observable, from, switchMap } from 'rxjs';
import { Buildcore } from '..';
import { toQueryParams, wrappedFetch } from '../fetch.utils';
import GetByIdGrouped from '../get/GetByIdGrouped';
import GetByIdGroupedLive from '../get/GetByIdGroupedLive';
import { fetchLive } from '../get/observable';
import { AwardOwnerSubset } from './award/AwardOwnerSubset';
import { AwardParticpateSubset } from './award/AwardParticipantSubset';
import { CollectionStatsSubset } from './collection/CollectionStatsSubset';
import { SubsetType } from './common';
import { MilestoneTransactionSubset } from './milestone/MilestoneTransactionSubset';
import { ProposalMemberSubset } from './proposal/ProposalMemberSubset';
import { SpaceBlockedMemberSubset } from './space/SpaceBlockedMemberSubset';
import { SpaceGuardianSubset } from './space/SpaceGuardianSubset';
import { SpaceKnockingMemberSubset } from './space/SpaceKnockingMemberSubset';
import { SpaceMemberSubset } from './space/SpaceMemberSubset';
import { TokenDistributionSubset } from './token/TokenDistributionSubset';
import { TokenStatsSubset } from './token/TokenStatsSubset';

export abstract class BaseSet<T> {
  constructor(
    protected readonly origin: Buildcore,
    protected readonly apiKey: string,
    protected readonly dataset: Dataset,
  ) {}

  protected getManyAdvancedLive = (params: GetManyAdvancedRequest): Observable<T[]> => {
    const url = this.origin + ApiRoutes.GET_MANY_ADVANCED + toQueryParams({ ...params });
    return fetchLive<T[]>(this.apiKey, url);
  };
}

abstract class BaseDataSetClass<T> extends BaseSet<T> {
  protected sendRequest =
    (name: WEN_FUNC) =>
    async <Req, Res>(request: BuildcoreRequest<Req>) => {
      const isLocal = !Object.values(Buildcore).includes(this.origin);
      const url = this.origin + `/${isLocal ? 'https-' : ''}` + name;
      try {
        return (await axios.post(url, { ...request, projectApiKey: this.apiKey })).data as Res;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        throw error.response.data;
      }
    };
}

/**
 * Dataset base class.
 */
export abstract class DatasetClass<D extends Dataset, T> extends BaseDataSetClass<T> {
  /**
   * Get many records by id.
   *
   * @param setIds
   * @returns
   */
  getManyById = (setIds: string[]) =>
    wrappedFetch<T[]>(this.apiKey, this.origin + ApiRoutes.GET_MANY_BY_ID, {
      dataset: this.dataset,
      setIds,
    });
  /**
   * Get many records by id. Real time stream.
   *
   * @param setIds
   * @returns
   */
  getManyByIdLive = (setIds: string[]): Observable<T[]> => {
    const params = { dataset: this.dataset, setIds };
    const url = this.origin + ApiRoutes.GET_MANY_BY_ID + toQueryParams({ ...params });
    return fetchLive<T[]>(this.apiKey, url);
  };

  /**
   * Get records by field.
   *
   * @param fieldName
   * @param fieldValue
   * @param startAfter
   * @returns
   */
  getByField = async (
    fieldName: string | string[],
    fieldValue: string | number | boolean | (string | number | boolean)[],
    startAfter?: string,
  ) => {
    const params = { dataset: this.dataset, fieldName, fieldValue, startAfter };
    return await wrappedFetch<T[]>(this.apiKey, this.origin + ApiRoutes.GET_MANY, params);
  };

  /**
   * Get records by field. Real time stream.
   * @param fieldName
   * @param fieldValue
   * @param startAfter
   * @returns
   */
  getByFieldLive = (
    fieldName: string | string[],
    fieldValue: string | number | boolean | (string | number | boolean)[],
    startAfter?: string,
  ): Observable<T[]> => {
    const params: GetManyRequest = { dataset: this.dataset, fieldName, fieldValue, startAfter };
    const url = this.origin + ApiRoutes.GET_MANY + toQueryParams({ ...params });
    return fetchLive<T[]>(this.apiKey, url);
  };

  /**
   * Get records by space.
   *
   * @param space
   * @param startAfter
   * @returns
   */
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

  /**
   * Get records by space. Real time stream.
   * @param space
   * @param startAfter
   * @returns
   */
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

  /**
   * Get all records updated after unix timestamp.
   *
   * @param updatedAfter
   * @param startAfter
   * @returns
   */
  getAllUpdatedAfter = async (updatedAfter: number, startAfter?: string) => {
    const params: GetUpdatedAfterRequest = { dataset: this.dataset, updatedAfter, startAfter };
    const url = this.origin + ApiRoutes.GET_UPDATED_AFTER;
    return await wrappedFetch<T[]>(this.apiKey, url, { ...params });
  };
  /**
   * Get all records updated after unix timestamp. Real time stream.
   *
   * @param updatedAfter
   * @param startAfter
   * @returns
   */
  getAllUpdatedAfterLive = (updatedAfter: number, startAfter?: string): Observable<T[]> => {
    const params: GetUpdatedAfterRequest = { dataset: this.dataset, updatedAfter, startAfter };
    const url = this.origin + ApiRoutes.GET_UPDATED_AFTER + toQueryParams({ ...params });
    return fetchLive<T[]>(this.apiKey, url);
  };

  getTop = async (limit?: number, startAfter?: string): Promise<T[]> => {
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
    const url = this.origin + ApiRoutes.GET_MANY_ADVANCED;
    return await wrappedFetch<T[]>(this.apiKey, url, { ...params });
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

  /**
   * Get specific record by id.
   *
   * @param setId
   * @returns
   */
  id = (setId: string) => new ExactDataSet<D, T>(this.origin, this.apiKey, this.dataset, setId);

  subset = <S extends Subset>(subset: S) =>
    new ExactDataSet<D, T>(this.origin, this.apiKey, this.dataset, '').subset(subset);
}

export class ExactDataSet<D extends Dataset, T> extends BaseSet<T> {
  constructor(
    origin: Buildcore,
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
        if (this.dataset === Dataset.PROPOSAL) {
          return new ProposalMemberSubset(
            this.origin,
            this.apiKey,
            this.dataset,
            this.setId,
            Subset.MEMBERS,
          ) as SubsetType<D, S>;
        }
        if (this.dataset === Dataset.SPACE) {
          return new SpaceMemberSubset(
            this.origin,
            this.apiKey,
            this.dataset,
            this.setId,
            Subset.MEMBERS,
          ) as SubsetType<D, S>;
        }
        throw Error('invalid subset name');
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
