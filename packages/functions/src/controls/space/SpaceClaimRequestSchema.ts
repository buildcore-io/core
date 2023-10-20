import { SpaceClaimRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const spaceClaimSchema = toJoiObject<SpaceClaimRequest>({
  uid: CommonJoi.uid().description('Build5 id of the space.'),
})
  .description('Request object to claim a space.')
  .meta({
    className: 'SpaceClaimRequest',
  });
