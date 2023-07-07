import { SpaceJoinRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';

export const spaceJoinSchema = toJoiObject<SpaceJoinRequest>({
  uid: CommonJoi.uid().description('Build5 id of the space.'),
})
  .description('Request object to join a space.')
  .meta({
    className: 'SpaceJoinRequest',
  });
