import { COL, Proposal } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { getProposalApprovalData } from '../../services/payment/tangle-service/proposal/ProposalApporvalService';

export const proposalApprovalControl =
  (approve: boolean) => async (owner: string, params: Record<string, unknown>) => {
    const proposal = params.uid as string;
    const data = await getProposalApprovalData(owner, proposal, approve);
    const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${proposal}`);
    await proposalDocRef.update(data);

    return await proposalDocRef.get<Proposal>();
  };
