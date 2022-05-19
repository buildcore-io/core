import { WEN_FUNC } from '../interfaces/functions';
import { isEmulatorEnv, isProdEnv } from './utils/config.utils';
import * as functions from 'firebase-functions';

export const low = 1;
export const medium = isProdEnv ? 3 : 2;
export const important = isProdEnv ? 6 : 2;
export const pump = isProdEnv ? 9 : 2;
export const superPump = isProdEnv ? 40 : 2;

export function scale(func: WEN_FUNC): number {
  const scaleSettings = {} as { [key: string]: number };
  scaleSettings[WEN_FUNC.cMemberNotExists] = important;
  scaleSettings[WEN_FUNC.uMember] = medium;

  // Space functions.
  scaleSettings[WEN_FUNC.cSpace] = low;
  scaleSettings[WEN_FUNC.uSpace] = low;
  scaleSettings[WEN_FUNC.joinSpace] = medium;
  scaleSettings[WEN_FUNC.leaveSpace] = low;
  scaleSettings[WEN_FUNC.addGuardianSpace] = low;
  scaleSettings[WEN_FUNC.removeGuardianSpace] = low;
  scaleSettings[WEN_FUNC.blockMemberSpace] = low;
  scaleSettings[WEN_FUNC.unblockMemberSpace] = low;
  scaleSettings[WEN_FUNC.acceptMemberSpace] = medium;
  scaleSettings[WEN_FUNC.declineMemberSpace] = low;
  scaleSettings[WEN_FUNC.setAlliance] = low;

  // Award Functions
  scaleSettings[WEN_FUNC.cAward] = low;
  scaleSettings[WEN_FUNC.addOwnerAward] = low;
  scaleSettings[WEN_FUNC.participateAward] = medium;
  scaleSettings[WEN_FUNC.aParticipantAward] = medium;

  // Proposal Functions
  scaleSettings[WEN_FUNC.cProposal] = low;
  scaleSettings[WEN_FUNC.aProposal] = low;
  scaleSettings[WEN_FUNC.rProposal] = low;
  scaleSettings[WEN_FUNC.voteOnProposal] = medium;

  // Collections
  scaleSettings[WEN_FUNC.cCollection] = medium;
  scaleSettings[WEN_FUNC.uCollection] = medium;
  scaleSettings[WEN_FUNC.approveCollection] = low;
  scaleSettings[WEN_FUNC.rejectCollection] = low;
  scaleSettings[WEN_FUNC.collectionWrite] = medium

  scaleSettings[WEN_FUNC.cNft] = medium;
  scaleSettings[WEN_FUNC.setForSaleNft] = medium;
  scaleSettings[WEN_FUNC.cBatchNft] = medium;

  scaleSettings[WEN_FUNC.orderNft] = pump;
  scaleSettings[WEN_FUNC.validateAddress] = medium;

  scaleSettings[WEN_FUNC.cToken] = low

  scaleSettings[WEN_FUNC.milestoneTransactionWrite] = superPump
  scaleSettings[WEN_FUNC.nftWrite] = medium
  scaleSettings[WEN_FUNC.transactionWrite] = superPump

  return isEmulatorEnv ? 0 : scaleSettings[func] || low;
}
