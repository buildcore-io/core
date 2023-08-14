import { Milestone, Network, TokenTradeOrderType } from '../models';
import { PublicCollections, PublicSubCollections } from './base';

/**
 * Base Request interface.
 */
export interface BaseRequest {
  readonly sessionId?: string;
}

/**
 * Get a record by it's ID.
 */
export interface GetByIdRequest extends BaseRequest {
  /**
   * Provide Collection, see available public collections {@link PublicCollections}
   */
  readonly collection: PublicCollections;
  /**
   * ID for the sub-collection (optional)
   */
  readonly uid: string;
  /**
   * ID for the parent collection.
   */
  readonly parentUid?: string;
  /**
   * Provide Collection, see available public sub-collections {@link PublicSubCollections} (optional)
   */
  readonly subCollection?: PublicSubCollections;
}

/**
 * Get many records by it's IDs
 */
export interface GetManyByIdRequest extends BaseRequest {
  /**
   * Provide Collection, see available public collections {@link PublicCollections}
   */
  readonly collection: PublicCollections;
  /**
   * Array of sub collection IDs for the sub-collection (optional)
   */
  readonly uids: string[];
  /**
   * Array of IDs for the collection
   */
  readonly parentUids?: string[];
  /**
   * Provide Collection, see available public sub-collections {@link PublicSubCollections} (optional)
   */
  readonly subCollection?: PublicSubCollections;
}

/**
 * Get many records by passing various conditions through fieldName/fieldValue
 *
 * startAfter allows pagging through the result.
 */
export interface GetManyRequest extends BaseRequest {
  /**
   * Provide Collection, see available public collections {@link PublicCollections}
   */
  readonly collection: PublicCollections;

  readonly uid?: string;
  readonly subCollection?: PublicSubCollections;

  readonly fieldName?: string | string[];
  readonly fieldValue?: string | number | boolean | (string | number | boolean)[];

  readonly startAfter?: string;
}

/**
 * Get all records updated after unix timestamp. Use startAfter to paginate.
 */
export interface GetUpdatedAfterRequest extends BaseRequest {
  /**
   * Provide Collection, see available public collections {@link PublicCollections}
   */
  readonly collection: PublicCollections;

  readonly uid?: string;
  readonly subCollection?: PublicSubCollections;

  /**
   * Unix milliseconds
   */
  readonly updatedAfter?: number;

  readonly startAfter?: string;
}

/**
 * Get token price
 */
export interface GetTokenPrice extends BaseRequest {
  readonly token: string | string[];
}

export interface GetTokenPriceResponse extends BaseRequest {
  readonly id: string;
  readonly price: number;
  readonly usdPrice: number;
}

/**
 * Get all Build.5 addresses per Network.
 */
export interface GetAddressesRequest extends BaseRequest {
  /**
   * Select Network. {@link Network}
   */
  readonly network: Network;
  /**
   * Address created after unix timestamp
   */
  readonly createdAfter?: number;
}

/**
 * Keep alive request to keep the session active.
 */
export interface KeepAliveRequest {
  /**
   * Session ID.
   */
  readonly sessionIds: string[];
  /**
   * Close?
   */
  readonly close?: boolean[];
}

/**
 * Available operators for filtering through GetManyAdvancedRequest.
 */
export enum Opr {
  EQUAL = '==',
  NOT_EQUAL = '!=',
  LESS = '<',
  LESS_OR_EQUAL = '<=',
  GREATER = '>',
  GREATER_OR_EQUAL = '>=',
  IN = 'in',
}

/**
 * Make advanced requests to read data within Build.5
 */
export interface GetManyAdvancedRequest extends BaseRequest {
  /**
   * Provide Collection, see available public collections {@link PublicCollections}
   */
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

/**
 * Get average trade per token.
 */
export interface GetAvgTradeRequest extends BaseRequest {
  readonly token: string;
  readonly type: TokenTradeOrderType;
}

/**
 * Get average price per token.
 */
export interface GetAvgPriceRequest extends BaseRequest {
  readonly token: string;
}

export interface GetAvgPriceResponse {
  readonly token: string;
  readonly avg: number;
}

/**
 * Get average price change in past 24 hours per token.
 */
export interface GetPriceChangeRequest extends BaseRequest {
  readonly token: string | string[];
}

export interface GetPriceChangeResponse {
  readonly id: string;
  readonly change: number;
}

/**
 * Get top milestone within all networks.
 */
export interface GetTopMilestonesRequest {
  readonly sessionId: string;
}

export type GetTopMilestonesResponse = { [key: string]: Milestone };
