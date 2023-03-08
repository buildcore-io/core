import { COL, Proposal } from '@soonaverse/interfaces';
import { Database } from '../../database/Database';
import { getProposalApprovalData } from '../../services/payment/tangle-service/proposal/ProposalApporvalService';

export const proposalApprovalControl =
  (approve: boolean) => async (owner: string, params: Record<string, unknown>) => {
    const proposal = params.uid as string;
    const data = await getProposalApprovalData(owner, proposal, approve);
    await Database.update(COL.PROPOSAL, { uid: proposal, ...data });
    return await Database.getById<Proposal>(COL.PROPOSAL, proposal);
  };
