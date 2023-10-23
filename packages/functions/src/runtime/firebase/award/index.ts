import { WEN_FUNC } from '@build-5/interfaces';
import { https } from '../../..';

export const createAward = https[WEN_FUNC.createAward];
export const addOwnerAward = https[WEN_FUNC.addOwnerAward];
export const fundAward = https[WEN_FUNC.fundAward];
export const rejectAward = https[WEN_FUNC.rejectAward];
export const cancelAward = https[WEN_FUNC.cancelAward];
export const awardParticipate = https[WEN_FUNC.participateAward];
export const approveAwardParticipant = https[WEN_FUNC.approveParticipantAward];
