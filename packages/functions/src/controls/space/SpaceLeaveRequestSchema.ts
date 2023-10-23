import { SpaceLeaveRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const spaceLeaveSchema = toJoiObject<SpaceLeaveRequest>({
  uid: CommonJoi.uid().description('Build5 id of the space.'),
})
  .description('Request object to leave a space.')
  .meta({
    className: 'SpaceLeaveRequest',
  });
