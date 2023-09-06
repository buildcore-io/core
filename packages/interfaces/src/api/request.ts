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
 *
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
  readonly sessionId: string;
  readonly instanceIds: string[];
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
 *
 * Note: We only enable certain filtering options. Refer to @build.5/lib for enabled indexations.
 */
export interface GetManyAdvancedRequest extends BaseRequest {
  /**
   * Provide Collection, see available public collections {@link PublicCollections}
   */
  readonly collection: PublicCollections;
  /**
   * Parent ID.
   */
  readonly uid?: string;
  /**
   * Provide Sub-Collection, see available public collections {@link PublicCollections}
   */
  readonly subCollection?: PublicSubCollections;
  /**
   * Array of fields to filter by (note, fieldName, fieldValue and operator must have same order)
   */
  readonly fieldName?: string[];
  /**
   * Array of field values to filter by (note, fieldName, fieldValue and operator must have same order)
   */
  readonly fieldValue?: (string | number | boolean)[];
  /**
   * Array of operators to filter by (note, fieldName, fieldValue and operator must have same order)
   */
  readonly operator?: Opr[];
  /**
   * Specify order by field.
   */
  readonly orderBy?: string[];
  /**
   * Specify order by direction.
   */
  readonly orderByDir?: string[];
  /**
   * Start after "doc" UID
   */
  readonly startAfter?: string;
  /**
   * Limit per query.
   */
  readonly limit?: number;
}

/**
 * Get average trade per token.
 */
export interface GetAvgTradeRequest extends BaseRequest {
  /**
   * Token UID
   */
  readonly token: string;
  /**
   * Token trade type {@link TokenTradeOrderType}
   */
  readonly type: TokenTradeOrderType;
}

/**
 * Get average price per token.
 *
 * returns {@link GetAvgPriceResponse}
 */
export interface GetAvgPriceRequest extends BaseRequest {
  /**
   * Token UID
   */
  readonly token: string;
}

/**
 * Get average price response.
 */
export interface GetAvgPriceResponse {
  readonly token: string;
  readonly avg: number;
}

/**
 * Get average price change in past 24 hours per token.
 */
export interface GetPriceChangeRequest extends BaseRequest {
  /**
   * Token UID or array of tokens
   */
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
  /**
   * Session ID.
   */
  readonly sessionId: string;
}

export type GetTopMilestonesResponse = { [key: string]: Milestone };
