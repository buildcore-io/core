import { build5Db } from '@build-5/database';
import { ApproveProposalRequest, COL, Proposal, RejectProposalRequest } from '@build-5/interfaces';
import { Context } from '../../runtime/firebase/common';
import { getProposalApprovalData } from '../../services/payment/tangle-service/proposal/ProposalApporvalService';

export const proposalApprovalControl =
  (approve: boolean) =>
  async ({ owner }: Context, params: ApproveProposalRequest | RejectProposalRequest) => {
    const data = await getProposalApprovalData(owner, params.uid, approve);
    const proposalDocRef = build5Db().doc(`${COL.PROPOSAL}/${params.uid}`);
    await proposalDocRef.update(data);
    return (await proposalDocRef.get<Proposal>())!;
  };
