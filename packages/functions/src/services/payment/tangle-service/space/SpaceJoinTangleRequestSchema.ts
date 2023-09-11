import { SpaceJoinTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const joinSpaceSchema = toJoiObject<SpaceJoinTangleRequest>({
  ...baseTangleSchema(TangleRequestType.SPACE_JOIN),
  uid: CommonJoi.uid().description('Build5 id of the space'),
})
  .description('Tangle request object to join a space.')
  .meta({
    className: 'SpaceJoinTangleRequest',
  });
