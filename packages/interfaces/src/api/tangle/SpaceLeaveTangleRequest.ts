/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Tangle request object to join a space.
 */
export interface SpaceLeaveTangleRequest {
  /**
   * Type of the tangle request.
   */
  requestType:
    | 'ADDRESS_VALIDATION'
    | 'SELL_TOKEN'
    | 'BUY_TOKEN'
    | 'STAKE'
    | 'NFT_PURCHASE'
    | 'CLAIM_MINTED_AIRDROPS'
    | 'AWARD_CREATE'
    | 'AWARD_FUND'
    | 'AWARD_APPROVE_PARTICIPANT'
    | 'PROPOSAL_CREATE'
    | 'PROPOSAL_APPROVE'
    | 'PROPOSAL_REJECT'
    | 'PROPOSAL_VOTE'
    | 'SPACE_CREATE'
    | 'SPACE_JOIN'
    | 'SPACE_ADD_GUARDIAN'
    | 'SPACE_REMOVE_GUARDIAN'
    | 'SPACE_ACCEPT_MEMBER'
    | 'SPACE_BLOCK_MEMBER'
    | 'SPACE_DECLINE_MEMBER'
    | 'SPACE_LEAVE'
    | 'MINT_METADATA_NFT';
  /**
   * Build5 id of the space
   */
  uid: string;
}
