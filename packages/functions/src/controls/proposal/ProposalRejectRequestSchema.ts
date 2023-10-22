import { RejectProposalRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const rejectProposaSchema = toJoiObject<RejectProposalRequest>({
  uid: CommonJoi.uid().description('Build5 id of the proposal to be rejected.'),
})
  .description('Request object to reject a proposal')
  .meta({
    className: 'RejectProposalRequest',
  });
