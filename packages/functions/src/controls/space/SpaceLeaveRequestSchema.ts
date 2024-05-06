import { SpaceLeaveRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const spaceLeaveSchema = toJoiObject<SpaceLeaveRequest>({
  uid: CommonJoi.uid().description('Buildcore id of the space.'),
})
  .description('Request object to leave a space.')
  .meta({
    className: 'SpaceLeaveRequest',
  });
