/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to update a collection.
 */
export interface UpdateCollectionRequest {
  /**
   * Access type of the collection.
   */
  access?: 0 | 1 | 2 | 3 | 4;
  /**
   * Buildcore id of awards. If set, only members having the specified awards can access this collection.
   */
  accessAwards?: any[];
  /**
   * Buildcore id of collections. If set, only members owning NFTs from the specified collection can access this collection.
   */
  accessCollections?: any[];
  /**
   * The collections available from data. It can be maximum 10 minutes in the past.
   */
  availableFrom?: Date;
  /**
   * Banner ulr.
   */
  bannerUrl?: string | null | '';
  /**
   * Description of the collection.
   */
  description: string | null | '';
  /**
   * Discord url of the collection.
   */
  discord?: string | null | '';
  /**
   * Array of discounts. Minimum 0, maximum 5.
   */
  discounts?: {
    /**
     * Amount of the discount to be applied. Minimum 0.01, maximum 1.
     */
    amount: number;
    /**
     * Token amount to be rewarded, minimum 0. This must be unique.
     */
    tokenReward: number;
    /**
     * Symbol of the token.
     */
    tokenSymbol: string;
  }[];
  /**
   * Name of the collection.
   */
  name: string | null | '';
  /**
   * If true, only on NFT can be owned per member from this collection.
   */
  onePerMemberOnly?: boolean;
  /**
   * Placeholder url.
   */
  placeholderUrl?: string | null | '';
  /**
   * Price of the collection. Minimum 1000000, maximum 1000000000000.
   */
  price?: number;
  /**
   * Royalty fee for the collection. Minimum 0, maximum 1
   */
  royaltiesFee: number;
  /**
   * Buildcore id of the royalty space.
   */
  royaltiesSpace?: string;
  /**
   * Twitter url of the collection.
   */
  twitter?: string | null | '';
  /**
   * Buildcore id of the collection.
   */
  uid: string;
  /**
   * Url for the collection.
   */
  url?: string | null | '';
}
