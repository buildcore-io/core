/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Tangle request object to join a space.
 */
export interface SpaceJoinTangleRequest {
  /**
   * Type of the tangle request.
   */
  requestType: 'SPACE_JOIN';
  /**
   * Buildcore id of the space
   */
  uid: string;
}
