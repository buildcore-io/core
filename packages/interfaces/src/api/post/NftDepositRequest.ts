/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to create an NFT deposit order
 */
export interface NftDepositRequest {
  /**
   * Network on wich the nft was minted.
   */
  network: 'iota' | 'smr' | 'atoi' | 'rms';
}
