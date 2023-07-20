import { Milestone, Network, TokenTradeOrderType } from '../models';
import { PublicCollections, PublicSubCollections } from './base';

export interface BaseRequest {
  readonly sessionId?: string;
}

export interface GetByIdRequest extends BaseRequest {
  readonly collection: PublicCollections;
  readonly uid: string;
  readonly parentUid?: string;
  readonly subCollection?: PublicSubCollections;
}

export interface GetManyByIdRequest extends BaseRequest {
  readonly collection: PublicCollections;
  readonly uids: string[];
  readonly parentUids?: string[];
  readonly subCollection?: PublicSubCollections;
}

export interface GetManyRequest extends BaseRequest {
  readonly collection: PublicCollections;

  readonly uid?: string;
  readonly subCollection?: PublicSubCollections;

  readonly fieldName?: string | string[];
  readonly fieldValue?: string | number | boolean | (string | number | boolean)[];

  readonly startAfter?: string;
}

export interface GetUpdatedAfterRequest extends BaseRequest {
  readonly collection: PublicCollections;

  readonly uid?: string;
  readonly subCollection?: PublicSubCollections;

  /** Unix milliseconds */
  readonly updatedAfter?: number;

  readonly startAfter?: string;
}

export interface GetTokenPrice extends BaseRequest {
  readonly token: string | string[];
}

export interface GetTokenPriceResponse extends BaseRequest {
  readonly id: string;
  readonly price: number;
  readonly usdPrice: number;
}

export interface GetAddressesRequest extends BaseRequest {
  readonly network: Network;
  readonly createdAfter?: number;
}

export interface KeepAliveRequest {
  readonly sessionIds: string[];
  readonly close?: boolean[];
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

export interface GetManyAdvancedRequest extends BaseRequest {
  readonly collection: PublicCollections;

  readonly uid?: string;
  readonly subCollection?: PublicSubCollections;

  readonly fieldName?: string[];
  readonly fieldValue?: (string | number | boolean)[];
  readonly operator?: Opr[];

  readonly orderBy?: string[];
  readonly orderByDir?: string[];

  readonly startAfter?: string;

  readonly limit?: number;
}

export interface GetAvgTradeRequest extends BaseRequest {
  readonly token: string;
  readonly type: TokenTradeOrderType;
}

export interface GetAvgPriceRequest extends BaseRequest {
  readonly token: string;
}

export interface GetAvgPriceResponse {
  readonly token: string;
  readonly avg: number;
}

export interface GetPriceChangeRequest extends BaseRequest {
  readonly token: string | string[];
}

export interface GetPriceChangeResponse {
  readonly id: string;
  readonly change: number;
}

export interface GetTopMilestonesRequest {
  readonly sessionId: string;
}

export type GetTopMilestonesResponse = { [key: string]: Milestone };
