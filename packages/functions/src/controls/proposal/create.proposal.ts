import { COL, Proposal, SUB_COL } from '@soonaverse/interfaces';
import { Database } from '../../database/Database';
import { createProposal } from '../../services/payment/tangle-service/proposal/ProposalCreateService';

export const createProposalControl = async (owner: string, params: Record<string, unknown>) => {
  const { proposal, proposalOwner } = await createProposal(owner, params);

  await Database.create(COL.PROPOSAL, proposal);
  await Database.create(COL.PROPOSAL, proposalOwner, SUB_COL.OWNERS, proposal.uid);

  return await Database.getById<Proposal>(COL.PROPOSAL, proposal.uid);
};
