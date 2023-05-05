import { Network } from '../models';
import { PublicCollections, PublicSubCollections } from './base';

export interface GetByIdRequest {
  readonly collection: PublicCollections;
  readonly uid: string;
  readonly parentUid?: string;
  readonly subCollection?: PublicSubCollections;
  readonly live?: boolean;
}

export interface GetManyRequest {
  readonly collection: PublicCollections;

  readonly uid?: string;
  readonly subCollection?: PublicSubCollections;

  readonly fieldName?: string | string[];
  readonly fieldValue?: string | number | boolean | (string | number | boolean)[];

  readonly startAfter?: string;

  readonly live?: boolean;
}

export interface GetUpdatedAfterRequest {
  readonly collection: PublicCollections;

  readonly uid?: string;
  readonly subCollection?: PublicSubCollections;

  /** Unix milliseconds */
  readonly updatedAfter?: number;

  readonly startAfter?: string;
  readonly live?: boolean;
}

export interface GetTokenPrice {
  readonly token: string;
}

export interface GetAddressesRequest {
  readonly network: Network;
  readonly createdAfter?: number;
  readonly live?: boolean;
}

export interface KeepAliveRequest {
  readonly instanceId: string;
}

export enum Opr {
  EQUAL = '==',
  NOT_EQUAL = '!=',
  LESS = '<',
  LESS_OR_EQUAL = '<=',
  GREATER = '>',
  GREATER_OR_EQUAL = '>=',
  IN = 'in',
}

export interface GetManyAdvancedRequest {
  readonly collection: PublicCollections;

  readonly uid?: string;
  readonly subCollection?: PublicSubCollections;

  readonly fieldName: string[];
  readonly fieldValue: (string | number | boolean)[];
  readonly operator: Opr[];

  readonly orderBy?: string[];
  readonly orderByDir?: string[];

  readonly startAfter?: string;

  readonly live?: boolean;
}
