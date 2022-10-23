import { PublicCollections, PublicSubCollections } from './base';

export interface GetByIdRequest {
  readonly collection: PublicCollections;

  readonly uids: string[];

  readonly parentUid?: string;
  readonly subCollection?: PublicSubCollections;
}

export interface GetManyRequest {
  readonly collection: PublicCollections;

  readonly uid?: string;
  readonly subCollection?: PublicSubCollections;

  readonly fieldName?: string;
  readonly fieldValue?: string;

  readonly startAfter?: string;
}
