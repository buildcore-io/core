/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to transfer NFTs
 */
export interface NftTransferRequest {
  /**
   * Provide list of NFTs to transfer to targetAddress or member id. Minimum 1, maximum 100
   */
  transfers: {
    /**
     * Buildcore id or tangle id of the nft.
     */
    nft: string;
    /**
     * Buildcore id of a member or a tangle address.
     */
    target: string;
    /**
     * If set, NFT will be always withdrawn.
     */
    withdraw?: boolean;
  }[];
}
