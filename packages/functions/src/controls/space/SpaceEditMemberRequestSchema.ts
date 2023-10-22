import { SpaceMemberUpsertRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const editSpaceMemberSchema = {
  uid: CommonJoi.uid().description('Build5 id of the space'),
  member: CommonJoi.uid().description('Build5 id of the member'),
};

export const editSpaceMemberSchemaObject = toJoiObject<SpaceMemberUpsertRequest>(
  editSpaceMemberSchema,
)
  .description('Request object to edit a space member.')
  .meta({
    className: 'SpaceMemberUpsertRequest',
  });
