/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Tangle request object to create an NFT purchase order
 */
export interface NftPurchaseTangleRequest {
  /**
   * Build5 id of the collection in case a random nft is bought.
   */
  collection: string;
  /**
   * If set to true, NFT will not be sent to the buyer's validated address upon purchase.
   */
  disableWithdraw?: boolean;
  /**
   * Build5 id of the nft to be purchased.
   */
  nft?: string;
  /**
   * Type of the tangle request.
   */
  requestType: 'NFT_PURCHASE';
}
