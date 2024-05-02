import { AwardApproveParticipantTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import { approveAwardParticipantSchema } from '../../../../controls/award/AwardApproveParticipantRequestSchema';
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
