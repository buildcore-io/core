import { ApproveProposalTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const proposalApproveSchema = toJoiObject<ApproveProposalTangleRequest>({
  ...baseTangleSchema(TangleRequestType.PROPOSAL_APPROVE, TangleRequestType.PROPOSAL_REJECT),
  uid: CommonJoi.uid().description('Build5 id of the proposal.'),
})
  .description('Tangle request object to approve a proposal')
  .meta({
    className: 'ApproveProposalTangleRequest',
  });
