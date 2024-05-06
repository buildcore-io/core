import { SpaceClaimRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const spaceClaimSchema = toJoiObject<SpaceClaimRequest>({
  uid: CommonJoi.uid().description('Buildcore id of the space.'),
})
  .description('Request object to claim a space.')
  .meta({
    className: 'SpaceClaimRequest',
  });
