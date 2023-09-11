import { AwardApproveParticipantTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { approveAwardParticipantSchema } from '../../../../runtime/firebase/award/AwardApproveParticipantRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const approveAwardParticipantSchemaObject =
  toJoiObject<AwardApproveParticipantTangleRequest>({
    ...baseTangleSchema(TangleRequestType.AWARD_APPROVE_PARTICIPANT),
    ...approveAwardParticipantSchema,
  })
    .description('Tangle request object to approve participants for an award.')
    .meta({
      className: 'AwardApproveParticipantTangleRequest',
    });
