import { WEN_FUNC } from '@build-5/interfaces';
import { https } from '../../..';

export const createSpace = https[WEN_FUNC.createSpace];

export const addGuardian = https[WEN_FUNC.addGuardianSpace];

export const removeGuardian = https[WEN_FUNC.removeGuardianSpace];
export const acceptMemberSpace = https[WEN_FUNC.acceptMemberSpace];

export const blockMember = https[WEN_FUNC.blockMemberSpace];

export const declineMemberSpace = https[WEN_FUNC.declineMemberSpace];
export const unblockMember = https[WEN_FUNC.unblockMemberSpace];

export const updateSpace = https[WEN_FUNC.updateSpace];

export const leaveSpace = https[WEN_FUNC.leaveSpace];

export const joinSpace = https[WEN_FUNC.joinSpace];

export const claimSpace = https[WEN_FUNC.claimSpace];
