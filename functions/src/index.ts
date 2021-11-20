import * as admin from 'firebase-admin';
import { WEN_FUNC } from './../interfaces/functions/index';
import { addOwner, approveParticipant, createAward, participate } from './controls/award.control';
import { createMember, updateMember } from './controls/member.control';
import { approveProposal, createProposal, rejectProposal, voteOnProposal } from './controls/proposal.control';
import { addGuardian, blockMember, createSpace, joinSpace, leaveSpace, removeGuardian, unblockMember, updateSpace } from './controls/space.control';
admin.initializeApp();

// List all various functions supported by Firebase functions.
// Members functions.
exports[WEN_FUNC.cMemberNotExists] = createMember;
exports[WEN_FUNC.uMember] = updateMember;

// Space functions.
exports[WEN_FUNC.cSpace] = createSpace;
exports[WEN_FUNC.uSpace] = updateSpace;
exports[WEN_FUNC.joinSpace] = joinSpace;
exports[WEN_FUNC.leaveSpace] = leaveSpace;
exports[WEN_FUNC.addGuardianSpace] = addGuardian;
exports[WEN_FUNC.removeGuardianSpace] = removeGuardian;
exports[WEN_FUNC.blockMemberSpace] = blockMember;
exports[WEN_FUNC.unblockMemberSpace] = unblockMember;

// Award Functions
exports[WEN_FUNC.cAward] = createAward;
exports[WEN_FUNC.addOwnerAward] = addOwner;
exports[WEN_FUNC.participateAward] = participate;
exports[WEN_FUNC.aAward] = approveParticipant;

// Award Functions
exports[WEN_FUNC.cProposal] = createProposal;
exports[WEN_FUNC.aProposal] = approveProposal;
exports[WEN_FUNC.rProposal] = rejectProposal;
exports[WEN_FUNC.voteOnProposal] = voteOnProposal;
