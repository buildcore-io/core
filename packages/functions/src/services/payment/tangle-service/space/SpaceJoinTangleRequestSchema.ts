import { SpaceJoinTangleRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';

export const joinSpaceSchema = toJoiObject<SpaceJoinTangleRequest>({
  uid: CommonJoi.uid().description('Build5 id of the space'),
})
  .description('Tangle request object to join a space.')
  .meta({
    className: 'SpaceJoinTangleRequest',
  });
