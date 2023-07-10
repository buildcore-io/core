import { SpaceLeaveTangleRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const leaveSpaceSchema = toJoiObject<SpaceLeaveTangleRequest>({
  ...baseTangleSchema,
  uid: CommonJoi.uid().description('Build5 id of the space'),
})
  .description('Tangle request object to join a space.')
  .meta({
    className: 'SpaceLeaveTangleRequest',
  });
