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
  addGuardianSpace = "addGuardianSpace",
  removeGuardianSpace = "removeGuardianSpace",


  // Award functions
  cAward = "cAward",
  aAward = "aAward", // Approve
  participateAward = "participateAward",

  cProposal = "cProposal",
  aProposal = "aProposal", // Approve
}

export interface cMemberNotExists {
  address: EthAddress;
}

export interface DecodedToken {
  address: string;
  body: any;
}

export interface StandardResponse {
  status: 'error'|'success';
  error?: string;
}
