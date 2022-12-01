import { EthAddress } from '../models/base';
export const enum WEN_FUNC {
  // Member functions.
  cMemberNotExists = 'cMemberNotExists',
  uMember = 'uMember',

  // Space functions.
  cSpace = 'cSpace',
  uSpace = 'uSpace',
  joinSpace = 'joinSpace',
  leaveSpace = 'leaveSpace',
  blockMemberSpace = 'blockMemberSpace',
  unblockMemberSpace = 'unblockMemberSpace',
  acceptMemberSpace = 'acceptMemberSpace',
  declineMemberSpace = 'declineMemberSpace',
  addGuardianSpace = 'addGuardianSpace',
  removeGuardianSpace = 'removeGuardianSpace',

  // Award functions
  cAward = 'cAward',
  aAward = 'aAward',
  rAward = 'rAward',
  addOwnerAward = 'addOwnerAward',
  participateAward = 'participateAward',
  aParticipantAward = 'aParticipantAward', // Approve.
  onProposalUpdated = 'onProposalUpdated',

  cProposal = 'cProposal',
  aProposal = 'aProposal', // Approve
  rProposal = 'rProposal', // Reject
  voteOnProposal = 'voteOnProposal',

  // Collection functions.
  cCollection = 'cCollection',
  uCollection = 'uCollection',
  approveCollection = 'approveCollection',
  rejectCollection = 'rejectCollection',
  collectionWrite = 'collectionWrite',
  mintCollection = 'mintCollection',

  // NFT functions.
  cNft = 'cNft',
  cBatchNft = 'cBatchNft',
  setForSaleNft = 'setForSaleNft',
  withdrawNft = 'withdrawNft',
  depositNft = 'depositNft',
  updateUnsoldNft = 'updateUnsoldNft',

  // ORDER functions.
  orderNft = 'orderNft',
  openBid = 'openBid',
  validateAddress = 'validateAddress',

  // TOKEN functions
  cToken = 'cToken',
  uToken = 'uToken',
  setTokenAvailableForSale = 'setTokenAvailableForSale',
  cancelPublicSale = 'cancelPublicSale',
  orderToken = 'orderToken',
  creditToken = 'creditToken',
  airdropToken = 'airdropToken',
  claimAirdroppedToken = 'claimAirdroppedToken',
  tradeToken = 'tradeToken',
  cancelTradeOrder = 'cancelTradeOrder',
  onTokenStatusUpdate = 'onTokenStatusUpdate',
  onTokenTradeOrderWrite = 'onTokenTradeOrderWrite',
  onTokenPurchaseCreated = 'onTokenPurchaseCreated',
  mintTokenOrder = 'mintTokenOrder',
  claimMintedTokenOrder = 'claimMintedTokenOrder',
  airdropMintedToken = 'airdropMintedToken',

  milestoneTransactionWrite = 'milestoneTransactionWrite',
  nftWrite = 'nftWrite',
  transactionWrite = 'transactionWrite',
  mnemonicWrite = 'mnemonicWrite',

  creditUnrefundable = 'creditUnrefundable',
  depositStake = 'depositStake',

  voteController = 'voteController',
  rankController = 'rankController',
  collectionStatsUpdate = 'collectionStatsUpdate',

  stakeReward = 'stakeReward',

  generateCustomFirebaseToken = 'generateCustomFirebaseToken',
}

export interface cMemberNotExists {
  address: EthAddress;
}

export interface DecodedToken {
  address: string;
  body: any;
}

export interface StandardResponse {
  status: 'error' | 'success';
  error?: string;
}
