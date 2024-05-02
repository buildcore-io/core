import { database } from '@buildcore/database';
import { ApproveProposalRequest, COL, RejectProposalRequest } from '@buildcore/interfaces';
import { getProposalApprovalData } from '../../services/payment/tangle-service/proposal/ProposalApporvalService';
import { Context } from '../common';

export const proposalApprovalControl =
  (approve: boolean) =>
  async ({ owner, params }: Context<ApproveProposalRequest | RejectProposalRequest>) => {
    const data = await getProposalApprovalData(owner, params.uid, approve);
    const proposalDocRef = database().doc(COL.PROPOSAL, params.uid);
    await proposalDocRef.update(data);
    return (await proposalDocRef.get())!;
  };
