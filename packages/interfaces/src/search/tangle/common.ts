export enum TangleRequestType {
  ADDRESS_VALIDATION = 'ADDRESS_VALIDATION',
  SELL_TOKEN = 'SELL_TOKEN',
  BUY_TOKEN = 'BUY_TOKEN',
  STAKE = 'STAKE',

  NFT_PURCHASE = 'NFT_PURCHASE',
  NFT_PURCHASE_BULK = 'NFT_PURCHASE_BULK',
  NFT_BID = 'NFT_BID',
  NFT_SET_FOR_SALE = 'NFT_SET_FOR_SALE',

  CLAIM_MINTED_AIRDROPS = 'CLAIM_MINTED_AIRDROPS',

  AWARD_CREATE = 'AWARD_CREATE',
  AWARD_FUND = 'AWARD_FUND',
  AWARD_APPROVE_PARTICIPANT = 'AWARD_APPROVE_PARTICIPANT',

  PROPOSAL_CREATE = 'PROPOSAL_CREATE',
  PROPOSAL_APPROVE = 'PROPOSAL_APPROVE',
  PROPOSAL_REJECT = 'PROPOSAL_REJECT',
  PROPOSAL_VOTE = 'PROPOSAL_VOTE',

  SPACE_CREATE = 'SPACE_CREATE',
  SPACE_JOIN = 'SPACE_JOIN',
  SPACE_ADD_GUARDIAN = 'SPACE_ADD_GUARDIAN',
  SPACE_REMOVE_GUARDIAN = 'SPACE_REMOVE_GUARDIAN',
  SPACE_ACCEPT_MEMBER = 'SPACE_ACCEPT_MEMBER',
  SPACE_BLOCK_MEMBER = 'SPACE_BLOCK_MEMBER',
  SPACE_DECLINE_MEMBER = 'SPACE_DECLINE_MEMBER',
  SPACE_LEAVE = 'SPACE_LEAVE',

  MINT_METADATA_NFT = 'MINT_METADATA_NFT',

  STAMP = 'STAMP',

  CREATE_AUCTION = 'CREATE_AUCTION',
  BID_AUCTION = 'BID_AUCTION',
}
