/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Request object to approve participants for an award.
 */
export interface AwardApproveParticipantRequest {
  /**
   * Buildcore id of the award
   */
  award: string;
  /**
   * Buildcore id or wallet address of the participants to approve. Minimum 1, maximum 1000
   */
  members: string[];
}
