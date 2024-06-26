/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to rank a collection or token.
 */
export interface RankRequest {
  /**
   * Buildcore collection name to rank.
   */
  collection: 'collection' | 'token';
  /**
   * Rank value. Minimum -100, maximum 100
   */
  rank: number;
  /**
   * Buildcore id of the entity to rank.
   */
  uid: string;
}
