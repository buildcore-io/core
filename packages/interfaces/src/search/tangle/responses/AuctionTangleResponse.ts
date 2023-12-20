import { TangleResponse } from './TangleResponse';

/**
 * Tangle response object returned after creating an auction
 */
export interface AuctionCreateTangleResponse extends TangleResponse {
  /**
   * Build5 id of the created auction
   */
  auction: string;
}
