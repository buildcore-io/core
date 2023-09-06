import { SpaceMemberUpsertTangleRequest } from '@build-5/interfaces';
import { editSpaceMemberSchema } from '../../../../runtime/firebase/space/SpaceEditMemberRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const editSpaceMemberSchemaObject = toJoiObject<SpaceMemberUpsertTangleRequest>({
  ...baseTangleSchema,
  ...editSpaceMemberSchema,
})
  .description('Tangle request object to edit a space member.')
  .meta({
    className: 'SpaceMemberUpsertTangleRequest',
  });
