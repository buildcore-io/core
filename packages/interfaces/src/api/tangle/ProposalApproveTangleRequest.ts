/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Tangle request object to approve a proposal
 */
export interface ApproveProposalTangleRequest {
  /**
   * Type of the tangle request.
   */
  requestType: 'PROPOSAL_APPROVE' | 'PROPOSAL_REJECT';
  /**
   * Build5 id of the proposal.
   */
  uid: string;
}
