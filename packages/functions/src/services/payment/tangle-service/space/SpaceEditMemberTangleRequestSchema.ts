import { SpaceMemberUpsertTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { editSpaceMemberSchema } from '../../../../controls/space/SpaceEditMemberRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const editSpaceMemberSchemaObject = toJoiObject<SpaceMemberUpsertTangleRequest>({
  ...baseTangleSchema(
    TangleRequestType.SPACE_ADD_GUARDIAN,
    TangleRequestType.SPACE_REMOVE_GUARDIAN,
    TangleRequestType.SPACE_ACCEPT_MEMBER,
    TangleRequestType.SPACE_BLOCK_MEMBER,
    TangleRequestType.SPACE_DECLINE_MEMBER,
  ),
  ...editSpaceMemberSchema,
})
  .description('Tangle request object to edit a space member.')
  .meta({
    className: 'SpaceMemberUpsertTangleRequest',
  });
