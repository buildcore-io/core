import { Network } from '../models';
import { PublicCollections, PublicSubCollections } from './base';

export interface GetByIdRequest {
  readonly collection: PublicCollections;
  readonly uid: string;
  readonly parentUid?: string;
  readonly subCollection?: PublicSubCollections;
}

export interface GetManyRequest {
  readonly collection: PublicCollections;

  readonly uid?: string;
  readonly subCollection?: PublicSubCollections;

  readonly fieldName?: string;
  readonly fieldValue?: string | number | boolean;

  readonly startAfter?: string;
}

export interface GetUpdatedAfterRequest {
  readonly collection: PublicCollections;

  readonly uid?: string;
  readonly subCollection?: PublicSubCollections;

  /** Unix milliseconds */
  readonly updatedAfter?: number;

  readonly startAfter?: string;
}

export interface GetTokenPrice {
  readonly token: string;
}

export interface GetAddressesRequest {
  readonly network: Network;
  readonly createdAfter?: number;
}
