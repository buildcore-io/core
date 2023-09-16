/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to create a token.
 */
export interface TokenCreateRequest {
  /**
   * Access type of the token
   */
  access: 0 | 1 | 2 | 3 | 4;
  /**
   * Build5 id of the awards. If present only members with the given awards can purchase this token.
   */
  accessAwards?: any[];
  /**
   * Build5 id of the collections. If present only members having NFTs from the give collections can purchase this token.
   */
  accessCollections?: any[];
  /**
   * Token supply allocations.
   */
  allocations: {
    /**
     * If true, this allocation is public. Only one public allocation is allowed.
     */
    isPublicSale?: boolean;
    /**
     * Percentage value of the allocaation. 
Minimum 0.01, maximum 100. 
The total percentage has to be 100
     */
    percentage: number;
    /**
     * Allocation name.
     */
    title: string;
  }[];
  /**
   * If true, purchases will be fullfilled once reuqest reach 100%.
   */
  autoProcessAt100Percent?: boolean;
  /**
   * Length of the cool down period. Minimum 0, maximum 2678400000
   */
  coolDownLength?: number;
  /**
   * Decimal value for the token. Minimum 0, maximum 20.
   */
  decimals: number;
  /**
   * Description of the token.
   */
  description?: string;
  /**
   * Build5 url pointing to the token icon.
   */
  icon: string;
  /**
   * Usefull links for the token.
   */
  links?: string[];
  /**
   * Name of the token.
   */
  name: string;
  /**
   * Build5 url pointing to the overview graphics of the token.
   */
  overviewGraphics: string;
  /**
   * Price per token. Minimum 0.000001, maximum 1000000000000.
   */
  pricePerToken?: number;
  /**
   * Length of the sale in milliseconds. Minimum 240000, maximum 2678400000
   */
  saleLength?: number;
  /**
   * Starting date of the token sale. Has to be 7 days in the future.
   */
  saleStartDate?: Date;
  /**
   * Short description of the token.
   */
  shortDescription?: string;
  /**
   * Short description title of the token.
   */
  shortDescriptionTitle?: string;
  /**
   * Build5 id of the space.
   */
  space: string;
  /**
   * Unique symbol of the token.
   */
  symbol: string;
  /**
   * Terms and conditions of the token.
   */
  termsAndConditions: string;
  /**
   * Title of the token.
   */
  title?: string;
  /**
   * Total token supply. Minimum 100, maximum 1e+26
   */
  totalSupply: number;
  /**
   * If true, trading is disabled for this token.
   */
  tradingDisabled?: true | false;
}