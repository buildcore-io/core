import { SpaceLeaveTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const leaveSpaceSchema = toJoiObject<SpaceLeaveTangleRequest>({
  ...baseTangleSchema(TangleRequestType.SPACE_LEAVE),
  uid: CommonJoi.uid().description('Buildcore id of the space'),
})
  .description('Tangle request object to join a space.')
  .meta({
    className: 'SpaceLeaveTangleRequest',
  });
