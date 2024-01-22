import { Milestone, Network, TokenTradeOrderType } from '../models';
import { Dataset, Subset } from './base';

export interface GetByIdRequest {
  readonly dataset: Dataset;
  readonly setId: string;
  readonly subset?: Subset;
  readonly subsetId?: string;
}

export interface GetManyByIdRequest {
  readonly dataset: Dataset;
  readonly setIds: string[];
  readonly subset?: Subset;
  readonly subsetIds?: string[];
}

export interface GetManyRequest {
  readonly dataset: Dataset;
  readonly setId?: string;
  readonly subset?: Subset;

  readonly fieldName?: string | string[];
  readonly fieldValue?: string | number | boolean | (string | number | boolean)[];

  readonly startAfter?: string;
}

export interface GetUpdatedAfterRequest {
  readonly dataset: Dataset;
  readonly setId?: string;
  readonly subset?: Subset;
  readonly updatedAfter?: number;
  readonly startAfter?: string;
}

export interface GetTokenPrice {
  readonly token: string | string[];
}

export interface GetTokenPriceResponse {
  readonly id: string;
  readonly price: number;
  readonly usdPrice: number;
}

/**
 * Get all Build.5 addresses per Network.
 *
 */
export interface GetAddressesRequest {
  readonly network: Network;
  readonly createdAfter: number;
}

export enum Opr {
  EQUAL = '==',
  NOT_EQUAL = '!=',
  LESS = '<',
  LESS_OR_EQUAL = '<=',
  GREATER = '>',
  GREATER_OR_EQUAL = '>=',
  IN = 'in',
  ARRAY_CONTAINS = 'array-contains',
}

export interface GetManyAdvancedRequest {
  readonly dataset: Dataset;
  readonly setId?: string;
  readonly subset?: Subset;
  readonly fieldName?: string[];
  readonly fieldValue?: (string | number | boolean)[];
  readonly operator?: Opr[];
  readonly orderBy?: string[];
  readonly orderByDir?: string[];
  readonly startAfter?: string;
  readonly limit?: number;
}

export interface GetAvgTradeRequest {
  readonly token: string;
  readonly type: TokenTradeOrderType;
}

export interface GetAvgPriceRequest {
  readonly token: string;
}

export interface GetAvgPriceResponse {
  readonly token: string;
  readonly avg: number;
}

/**
 * Get average price change in past 24 hours per token.
 */
export interface GetPriceChangeRequest {
  readonly token: string | string[];
}

export interface GetPriceChangeResponse {
  readonly id: string;
  readonly change: number;
}

export interface GetTopMilestonesRequest {}

export type GetTopMilestonesResponse = { [key: string]: Milestone };

export interface GetNftMutableData {
  readonly network?: Network;
  readonly nftId: string;
}

export interface GetNftIds {
  readonly network?: Network;
  readonly collectionId: string;
}

export interface GetNftMutableMetadatHistory {
  readonly network?: Network;
  readonly nftId: string;
}
