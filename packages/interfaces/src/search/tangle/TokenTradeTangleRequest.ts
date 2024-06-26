/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Tangle request object to trade a token.
 */
export interface TradeTokenTangleRequest {
  /**
   * Count of the tokens to be bought. Only specify is type is BUY. Minimum 1, maximum 1e+26
   */
  count?: number;
  /**
   * Price of the token to trade. Minimum 0.000001, maximum: 1000000000000.
   */
  price?: number;
  /**
   * Type of the tangle request.
   */
  requestType: 'BUY_TOKEN' | 'SELL_TOKEN';
  /**
   * Symbol of the token to trade. Set it only during minted token trade.
   */
  symbol?: string;
  /**
   * Funds will be sent here in case of a successfull trade.
   */
  targetAddress?: string;
}
