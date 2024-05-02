import { RejectProposalRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const rejectProposaSchema = toJoiObject<RejectProposalRequest>({
  uid: CommonJoi.uid().description('Buildcore id of the proposal to be rejected.'),
})
  .description('Request object to reject a proposal')
  .meta({
    className: 'RejectProposalRequest',
  });
