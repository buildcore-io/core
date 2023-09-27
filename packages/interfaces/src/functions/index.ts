import { NetworkAddress } from '../models/base';

export enum WEN_FUNC_TRIGGER {
  onProposalUpdated = 'onproposalupdated',
  awardTrigger = 'awardtrigger',
  collectionWrite = 'collectionwrite',
  onTokenStatusUpdate = 'ontokenstatusupdate',
  onTokenTradeOrderWrite = 'ontokentradeorderwrite',
  onTokenPurchaseCreated = 'ontokenpurchasecreated',
  milestoneTransactionWrite = 'milestonetransactionwrite',
  nftWrite = 'nftwrite',
  transactionWrite = 'transactionwrite',
  mnemonicWrite = 'mnemonicwrite',
  collectionStatsUpdate = 'collectionstatsupdate',
  algolia = 'algolia',
  resizeImg = 'resizeimg',
}

export enum WEN_FUNC {
  // Member functions.
  createMember = 'cmembernotexists',
  updateMember = 'umember',

  // Space functions.
  createSpace = 'cspace',
  updateSpace = 'uspace',
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
  createAward = 'caward',
  fundAward = 'fundaward',
  rejectAward = 'raward',
  addOwnerAward = 'addowneraward',
  participateAward = 'participateaward',
  approveParticipantAward = 'aparticipantaward',
  cancelAward = 'cancelaward',

  createProposal = 'cproposal',
  approveProposal = 'aproposal',
  rejectProposal = 'rproposal',
  voteOnProposal = 'voteonproposal',

  // Collection functions.
  createCollection = 'ccollection',
  updateCollection = 'ucollection',
  approveCollection = 'approvecollection',
  rejectCollection = 'rejectcollection',
  mintCollection = 'mintcollection',

  // NFT functions.
  createNft = 'cnft',
  createBatchNft = 'cbatchnft',
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
  createToken = 'ctoken',
  updateToken = 'utoken',
  setTokenAvailableForSale = 'settokenavailableforsale',
  cancelPublicSale = 'cancelpublicsale',
  orderToken = 'ordertoken',
  creditToken = 'credittoken',
  airdropToken = 'airdroptoken',
  claimAirdroppedToken = 'claimairdroppedtoken',
  tradeToken = 'tradetoken',
  cancelTradeOrder = 'canceltradeorder',

  mintTokenOrder = 'minttokenorder',
  claimMintedTokenOrder = 'claimmintedtokenorder',
  airdropMintedToken = 'airdropmintedtoken',
  enableTokenTrading = 'enabletokentrading',
  importMintedToken = 'importmintedtoken',

  creditUnrefundable = 'creditunrefundable',
  depositStake = 'depositstake',

  voteController = 'votecontroller',
  rankController = 'rankcontroller',

  stakeReward = 'stakereward',
  removeStakeReward = 'removestakereward',

  generateCustomToken = 'generatecustomtoken',

  api = 'api',

  uploadFile = 'uploadfile',

  createProject = 'createProject',
  deactivateProject = 'deactivateProject',
  createProjetApiKey = 'createProjetApiKey',

  stamp = 'stamp',
}

export interface cMemberNotExists {
  address: NetworkAddress;
}

export interface DecodedToken {
  address: NetworkAddress;
  project: string;
  body: any;
}

export interface StandardResponse {
  status: 'error' | 'success';
  error?: string;
}
