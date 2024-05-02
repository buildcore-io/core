import { ApproveProposalRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const approveProposaSchema = toJoiObject<ApproveProposalRequest>({
  uid: CommonJoi.uid().description('Buildcore id of the proposal to be approved.'),
})
  .description('Request object to approve a proposal')
  .meta({
    className: 'ApproveProposalRequest',
  });
