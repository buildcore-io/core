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

  /** Unix seconds */
  readonly updatedAfter?: number;
}

export interface GetTokenPrice {
  readonly token: string;
}
