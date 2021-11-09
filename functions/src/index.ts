import * as admin from 'firebase-admin';
import { WEN_FUNC } from './../interfaces/functions/index';
import { createMember, updateMember } from './controls/member.control';
import { addGuardian, blockMember, createSpace, joinSpace, leaveSpace, removeGuardian, unblockMember, updateSpace } from './controls/space.control';
admin.initializeApp();

// List all various functions supported by Firebase functions.
exports[WEN_FUNC.cMemberNotExists] = createMember;
exports[WEN_FUNC.uMember] = updateMember;

exports[WEN_FUNC.cSpace] = createSpace;
exports[WEN_FUNC.uSpace] = updateSpace;
exports[WEN_FUNC.joinSpace] = joinSpace;
exports[WEN_FUNC.leaveSpace] = leaveSpace;
exports[WEN_FUNC.addGuardianSpace] = addGuardian;
exports[WEN_FUNC.removeGuardianSpace] = removeGuardian;
exports[WEN_FUNC.blockMemberSpace] = blockMember;
exports[WEN_FUNC.unblockMemberSpace] = unblockMember;
