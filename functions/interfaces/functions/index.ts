import { EthAddress } from '../models/base';
export const enum WEN_FUNC {
  // Member functions.
  cMemberNotExists = "cMemberNotExists",
  uMember = "uMember",

  // Space functions.
  cSpace = "cSpace",
  uSpace = "uSpace",
  joinSpace = "joinSpace",
  leaveSpace = "leaveSpace",
  blockMemberSpace = "blockMemberSpace",
  unblockMemberSpace = "unblockMemberSpace",
  acceptMemberSpace = "acceptMemberSpace",
  declineMemberSpace = "declineMemberSpace",
  addGuardianSpace = "addGuardianSpace",
  removeGuardianSpace = "removeGuardianSpace",
  setAlliance = "setAlliance",

  // Award functions
  cAward = "cAward",
  aAward = "aAward",
  rAward = "rAward",
  addOwnerAward = "addOwnerAward",
  participateAward = "participateAward",
  aParticipantAward = "aParticipantAward", // Approve.

  cProposal = "cProposal",
  aProposal = "aProposal", // Approve
  rProposal = "rProposal", // Reject
  voteOnProposal = "voteOnProposal",

  // Collection functions.
  cCollection = "cCollection",
  uCollection = "uCollection",
  approveCollection = "approveCollection",
  rejectCollection = "rejectCollection",

  // NFT functions.
  cNft = "cNft",
  cBatchNft = "cBatchNft",
  setForSaleNft = "setForSaleNft",

  // ORDER functions.
  orderNft = "orderNft",
  openBid = "openBid",
  validateAddress = "validateAddress",

  // TOKEN functions
  cToken = 'cToken',
  uToken = 'uToken',
  orderToken = 'orderToken',
  creditToken = 'creditToken'
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
