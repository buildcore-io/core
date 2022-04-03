import * as functions from 'firebase-functions';
import { WEN_FUNC } from '../interfaces/functions';

export const low = (functions.config()?.environment?.type === 'prod') ? 1 : 1;
export const medium = (functions.config()?.environment?.type === 'prod') ? 3 : 2;
export const important = (functions.config()?.environment?.type === 'prod') ? 6 : 2;
export const pump = (functions.config()?.environment?.type === 'prod') ? 9 : 2;
export const superPump = (functions.config()?.environment?.type === 'prod') ? 60 : 2;

export function scale(func: WEN_FUNC): number {
  const scaleSettings: any = {};
  scaleSettings[WEN_FUNC.cMemberNotExists] = pump;
  scaleSettings[WEN_FUNC.uMember] = important;

  // Space functions.
  scaleSettings[WEN_FUNC.cSpace] = medium;
  scaleSettings[WEN_FUNC.uSpace] = low;
  scaleSettings[WEN_FUNC.joinSpace] = important;
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

  scaleSettings[WEN_FUNC.cNft] = medium;
  scaleSettings[WEN_FUNC.setForSaleNft] = medium;
  scaleSettings[WEN_FUNC.cBatchNft] = medium;

  scaleSettings[WEN_FUNC.orderNft] = superPump;
  scaleSettings[WEN_FUNC.validateAddress] = superPump;

  return scaleSettings[func] || low;
}
