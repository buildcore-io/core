import { SpaceJoinRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const spaceJoinSchema = toJoiObject<SpaceJoinRequest>({
  uid: CommonJoi.uid().description('Buildcore id of the space.'),
})
  .description('Request object to join a space.')
  .meta({
    className: 'SpaceJoinRequest',
  });
