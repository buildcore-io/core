import { WEN_FUNC } from '@build-5/interfaces';
import { proposalApprovalControl } from '../../../controls/proposal/approve.reject.proposal';
import { createProposalControl } from '../../../controls/proposal/create.proposal';
import { voteOnProposalControl } from '../../../controls/proposal/vote.on.proposal';
import { approveProposaSchema } from './ProposalApproveRequestSchema';
import { proposalCreateSchemaObject } from './ProposalCreateRequestSchema';
import { rejectProposaSchema } from './ProposalRejectRequestSchema';
import { voteOnProposalSchemaObject } from './ProposalVoteRequestSchema';
import { onRequest } from '../common';

export const createProposal = onRequest(WEN_FUNC.createProposal, {
  timeoutSeconds: 300,
  memory: '2GiB',
})(proposalCreateSchemaObject, createProposalControl);

export const approveProposal = onRequest(WEN_FUNC.approveProposal)(
  approveProposaSchema,
  proposalApprovalControl(true),
);

export const rejectProposal = onRequest(WEN_FUNC.rejectProposal)(
  rejectProposaSchema,
  proposalApprovalControl(false),
);

export const voteOnProposal = onRequest(WEN_FUNC.voteOnProposal)(
  voteOnProposalSchemaObject,
  voteOnProposalControl,
);
