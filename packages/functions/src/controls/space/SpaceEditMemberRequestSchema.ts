import { SpaceMemberUpsertRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const editSpaceMemberSchema = {
  uid: CommonJoi.uid().description('Buildcore id of the space'),
  member: CommonJoi.uid().description('Buildcore id of the member'),
};

export const editSpaceMemberSchemaObject = toJoiObject<SpaceMemberUpsertRequest>(
  editSpaceMemberSchema,
)
  .description('Request object to edit a space member.')
  .meta({
    className: 'SpaceMemberUpsertRequest',
  });
