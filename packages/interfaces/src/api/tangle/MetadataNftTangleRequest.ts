/**
 * This file was automatically generated by joi-to-typescript
 * Do not modify this file manually
 */

/**
 * Tangle request object to create or update a metadata nft.
 */
export interface MintMetadataNftTangleRequest {
  /**
   * Alias tangle id. The new nft will belong to this alias.
   */
  aliasId?: string;
  /**
   * Collection tangle id. The new nft will belong to this collection.
   */
  collectionId?: string;
  /**
   * Metadata object of for the nft.
   */
  metadata: object;
  /**
   * Nft network id. Only specify it in case of edit.
   */
  nftId?: string;
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
}