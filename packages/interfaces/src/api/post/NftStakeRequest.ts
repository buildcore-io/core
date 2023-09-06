/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to create an NFT stake order.
 */
export interface NftStakeRequest {
  /**
   * Network on which the nft was staked.
   */
  network: 'smr' | 'rms';
  /**
   * Type of the stake.
   */
  type: 'static' | 'dynamic';
  /**
   * Amount of weeks for which the NFT will be staked. Minimum 1, maximum 52
   */
  weeks: number;
}
