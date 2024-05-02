import { ApproveProposalTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const proposalApproveSchema = toJoiObject<ApproveProposalTangleRequest>({
  ...baseTangleSchema(TangleRequestType.PROPOSAL_APPROVE, TangleRequestType.PROPOSAL_REJECT),
  uid: CommonJoi.uid().description('Buildcore id of the proposal.'),
})
  .description('Tangle request object to approve a proposal')
  .meta({
    className: 'ApproveProposalTangleRequest',
  });
