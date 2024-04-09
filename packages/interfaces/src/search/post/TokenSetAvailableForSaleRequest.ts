/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to update a token.
 */
export interface SetTokenForSaleRequest {
  /**
   * If true, purchases will be fullfilled once reuqest reach 100%.
   */
  autoProcessAt100Percent?: boolean;
  /**
   * Length of the cool down period. Minimum 0, maximum 2678400000
   */
  coolDownLength: number;
  /**
   * Price per token. Minimum 0.000001, maximum 1000000000000.
   */
  pricePerToken: number;
  /**
   * Length of the sale in milliseconds. Minimum 240000, maximum 2678400000
   */
  saleLength: number;
  /**
   * Start date of the sale. It has to be 7 days in the future.
   */
  saleStartDate: Date;
  /**
   * Build5 id of the token.
   */
  token: string;
}
