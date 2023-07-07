/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to create an NFT
 */
export interface NftCreateRequest {
  /**
   * Starting date of the nft's availability.
   */
  availableFrom: Date;
  /**
   * Build5 id of the collection for this nft.
   */
  collection: string;
  /**
   * Description of the nft.
   */
  description: string | null | '';
  /**
   * Soonaverse url pointing to an nft image or video.
   */
  media?: string | null | '';
  /**
   * Name of the nft
   */
  name: string | null | '';
  /**
   * Price of the nft. Minimum 1000000, maximum 1000000000000
   */
  price: number;
  /**
   * Property object of the nft
   */
  properties?: object;
  /**
   * If present only these members can buy the nft.
   */
  saleAccessMembers?: string[];
  /**
   * Stat object of the nft
   */
  stats?: object;
  /**
   * Url description for the nft.
   */
  url?: string | null | '';
}
