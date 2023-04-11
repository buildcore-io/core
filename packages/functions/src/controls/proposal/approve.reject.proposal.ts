import { COL, Proposal } from '@soonaverse/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { getProposalApprovalData } from '../../services/payment/tangle-service/proposal/ProposalApporvalService';

export const proposalApprovalControl =
  (approve: boolean) => async (owner: string, params: Record<string, unknown>) => {
    const proposal = params.uid as string;
    const data = await getProposalApprovalData(owner, proposal, approve);
    const proposalDocRef = soonDb().doc(`${COL.PROPOSAL}/${proposal}`);
    await proposalDocRef.update(data);

    return await proposalDocRef.get<Proposal>();
  };
