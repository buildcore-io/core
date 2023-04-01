import { EthAddress } from '../models/base';
export const enum WEN_FUNC {
  // Member functions.
  cMemberNotExists = 'cmembernotexists',
  uMember = 'umember',

  // Space functions.
  cSpace = 'cspace',
  uSpace = 'uspace',
  joinSpace = 'joinspace',
  leaveSpace = 'leavespace',
  blockMemberSpace = 'blockmemberspace',
  unblockMemberSpace = 'unblockmemberspace',
  acceptMemberSpace = 'acceptmemberspace',
  declineMemberSpace = 'declinememberspace',
  addGuardianSpace = 'addguardianspace',
  removeGuardianSpace = 'removeguardianspace',
  claimSpace = 'claimspace',

  // Award functions
  cAward = 'caward',
  fundAward = 'fundaward',
  rAward = 'raward',
  addOwnerAward = 'addowneraward',
  participateAward = 'participateaward',
  aParticipantAward = 'aparticipantaward', // Approve.
  onProposalUpdated = 'onproposalupdated',
  awardTrigger = 'awardtrigger',
  cancelAward = 'cancelaward',

  cProposal = 'cproposal',
  aProposal = 'aproposal', // Approve
  rProposal = 'rproposal', // Reject
  voteOnProposal = 'voteonproposal',

  // Collection functions.
  cCollection = 'ccollection',
  uCollection = 'ucollection',
  approveCollection = 'approvecollection',
  rejectCollection = 'rejectcollection',
  collectionWrite = 'collectionwrite',
  mintCollection = 'mintcollection',

  // NFT functions.
  cNft = 'cnft',
  cBatchNft = 'cbatchnft',
  setForSaleNft = 'setforsalenft',
  withdrawNft = 'withdrawnft',
  depositNft = 'depositnft',
  updateUnsoldNft = 'updateunsoldnft',
  stakeNft = 'stakenft',

  // ORDER functions.
  orderNft = 'ordernft',
  openBid = 'openbid',
  validateAddress = 'validateaddress',

  // TOKEN functions
  cToken = 'ctoken',
  uToken = 'utoken',
  setTokenAvailableForSale = 'settokenavailableforsale',
  cancelPublicSale = 'cancelpublicsale',
  orderToken = 'ordertoken',
  creditToken = 'credittoken',
  airdropToken = 'airdroptoken',
  claimAirdroppedToken = 'claimairdroppedtoken',
  tradeToken = 'tradetoken',
  cancelTradeOrder = 'canceltradeorder',
  onTokenStatusUpdate = 'ontokenstatusupdate',
  onTokenTradeOrderWrite = 'ontokentradeorderwrite',
  onTokenPurchaseCreated = 'ontokenpurchasecreated',
  mintTokenOrder = 'minttokenorder',
  claimMintedTokenOrder = 'claimmintedtokenorder',
  airdropMintedToken = 'airdropmintedtoken',
  enableTokenTrading = 'enabletokentrading',
  importMintedToken = 'importmintedtoken',

  milestoneTransactionWrite = 'milestonetransactionwrite',
  nftWrite = 'nftwrite',
  transactionWrite = 'transactionwrite',
  mnemonicWrite = 'mnemonicwrite',

  creditUnrefundable = 'creditunrefundable',
  depositStake = 'depositstake',

  voteController = 'votecontroller',
  rankController = 'rankcontroller',
  collectionStatsUpdate = 'collectionstatsupdate',

  stakeReward = 'stakereward',
  removeStakeReward = 'removestakereward',

  generateCustomFirebaseToken = 'generatecustomfirebasetoken',

  algolia = 'algolia',

  resizeImg = 'resizeimg',

  api = 'api',
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
