import * as admin from 'firebase-admin';
import { WEN_FUNC } from './../interfaces/functions/index';
import { addOwner, approveAward, approveParticipant, createAward, participate, rejectAward } from './controls/award.control';
import { approveCollection, createCollection, rejectCollection, updateCollection } from './controls/collection.control';
import { createMember, updateMember } from './controls/member.control';
import { createBatchNft, createNft } from './controls/nft.control';
import { orderNft, validateAddress } from './controls/order.control';
import { approveProposal, createProposal, rejectProposal, voteOnProposal } from './controls/proposal.control';
import { acceptMemberSpace, addGuardian, blockMember, createSpace, declineMemberSpace, joinSpace, leaveSpace, removeGuardian, setAlliance, unblockMember, updateSpace } from './controls/space.control';
import { markAwardsAsComplete } from "./cron";
import { milestoneWrite } from './triggers/milestone.trigger';
import { transactionWrite } from './triggers/transaction.trigger';
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
exports[WEN_FUNC.acceptMemberSpace] = acceptMemberSpace;
exports[WEN_FUNC.declineMemberSpace] = declineMemberSpace;
exports[WEN_FUNC.setAlliance] = setAlliance;

// Award Functions
exports[WEN_FUNC.cAward] = createAward;
exports[WEN_FUNC.aAward] = approveAward;
exports[WEN_FUNC.rAward] = rejectAward;
exports[WEN_FUNC.addOwnerAward] = addOwner;
exports[WEN_FUNC.participateAward] = participate;
exports[WEN_FUNC.aParticipantAward] = approveParticipant;

// Award Functions
exports[WEN_FUNC.cProposal] = createProposal;
exports[WEN_FUNC.aProposal] = approveProposal;
exports[WEN_FUNC.rProposal] = rejectProposal;
exports[WEN_FUNC.voteOnProposal] = voteOnProposal;

// Collection functions
exports[WEN_FUNC.cCollection] = createCollection;
exports[WEN_FUNC.uCollection] = updateCollection;
exports[WEN_FUNC.approveCollection] = approveCollection;
exports[WEN_FUNC.rejectCollection] = rejectCollection;

// NFT Functions
exports[WEN_FUNC.cNft] = createNft;
exports[WEN_FUNC.cBatchNft] = createBatchNft;

// Order functions
exports[WEN_FUNC.orderNft] = orderNft;
exports[WEN_FUNC.validateAddress] = validateAddress;

// CRON Tasks
exports['cron_markAwardsAsComplete'] = markAwardsAsComplete;

// TRIGGER Tasks
exports['trigger_milestoneWrite'] = milestoneWrite;
exports['trigger_transactionWrite'] = transactionWrite;
