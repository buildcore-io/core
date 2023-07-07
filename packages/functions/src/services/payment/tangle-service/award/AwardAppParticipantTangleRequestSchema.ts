import { AwardApproveParticipantTangleRequest } from '@build-5/interfaces';
import { approveAwardParticipantSchema } from '../../../../runtime/firebase/award/AwardApproveParticipantRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const approveAwardParticipantSchemaObject =
  toJoiObject<AwardApproveParticipantTangleRequest>({
    ...baseTangleSchema,
    ...approveAwardParticipantSchema,
  })
    .description('Tangle request object to approve participants for an award.')
    .meta({
      className: 'AwardApproveParticipantTangleRequest',
    });
