/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Tangle request object to set swap as funded.
 */
export interface SwapRejectTangleRequest {
  /**
   * Type of the tangle request.
   */
  requestType: 'REJECT_SWAP';
  /**
   * Buildcore UID of the swap
   */
  uid: string;
}
