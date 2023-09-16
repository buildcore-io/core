/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to credit a token purchase order.
 */
export interface CreditTokenRequest {
  /**
   * Amoun to credit. Minimum 1000000, maximum 1000000000000
   */
  amount: number;
  /**
   * Build5 id of the token.
   */
  token: string;
}