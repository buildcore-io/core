/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to edit a space member.
 */
export interface SpaceMemberUpsertRequest {
  /**
   * Build5 id of the member
   */
  member: string;
  /**
   * Build5 id of the space
   */
  uid: string;
}