import { WEN_FUNC } from '@build-5/interfaces';
import { https } from '../../..';

export const createProposal = https[WEN_FUNC.createProposal];
export const approveProposal = https[WEN_FUNC.approveProposal];
export const rejectProposal = https[WEN_FUNC.rejectProposal];
export const voteOnProposal = https[WEN_FUNC.voteOnProposal];
