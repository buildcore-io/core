import { WEN_FUNC } from '../interfaces/functions';

export function scale(func: WEN_FUNC): number {
  const low = 1;
  const medium = 3;
  const important = 6;
  const scaleSettings: any = {};
  scaleSettings[WEN_FUNC.cMemberNotExists] = important;
  scaleSettings[WEN_FUNC.uMember] = low;

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

  // Award Functions
  scaleSettings[WEN_FUNC.cAward] = low;
  scaleSettings[WEN_FUNC.addOwnerAward] = low;
  scaleSettings[WEN_FUNC.participateAward] = medium;
  scaleSettings[WEN_FUNC.aAward] = medium;

  // Proposal Functions
  scaleSettings[WEN_FUNC.cProposal] = low;
  scaleSettings[WEN_FUNC.aProposal] = low;
  scaleSettings[WEN_FUNC.rProposal] = low;
  scaleSettings[WEN_FUNC.voteOnProposal] = medium;

  return scaleSettings[func] || low;
}
