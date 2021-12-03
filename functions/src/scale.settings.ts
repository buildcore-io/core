import { WEN_FUNC } from '../interfaces/functions';

export function scale(func: WEN_FUNC): number {
  const scaleSettings: any = {};
  scaleSettings[WEN_FUNC.cMemberNotExists] = 3;
  scaleSettings[WEN_FUNC.uMember] = 1;

  // Space functions.
  scaleSettings[WEN_FUNC.cSpace] = 1;
  scaleSettings[WEN_FUNC.uSpace] = 1;
  scaleSettings[WEN_FUNC.joinSpace] = 3;
  scaleSettings[WEN_FUNC.leaveSpace] = 1;
  scaleSettings[WEN_FUNC.addGuardianSpace] = 1;
  scaleSettings[WEN_FUNC.removeGuardianSpace] = 1;
  scaleSettings[WEN_FUNC.blockMemberSpace] = 1;
  scaleSettings[WEN_FUNC.unblockMemberSpace] = 1;
  scaleSettings[WEN_FUNC.acceptMemberSpace] = 1;
  scaleSettings[WEN_FUNC.declineMemberSpace] = 1;

  // Award Functions
  scaleSettings[WEN_FUNC.cAward] = 1;
  scaleSettings[WEN_FUNC.addOwnerAward] = 1;
  scaleSettings[WEN_FUNC.participateAward] = 3;
  scaleSettings[WEN_FUNC.aAward] = 1;

  // Proposal Functions
  scaleSettings[WEN_FUNC.cProposal] = 1;
  scaleSettings[WEN_FUNC.aProposal] = 1;
  scaleSettings[WEN_FUNC.rProposal] = 1;
  scaleSettings[WEN_FUNC.voteOnProposal] = 2;

  return scaleSettings[func] || 1;
}
