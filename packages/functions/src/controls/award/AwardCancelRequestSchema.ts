import { AwardCancelRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const awardCancelSchema = toJoiObject<AwardCancelRequest>({
  uid: CommonJoi.uid().description('Build5 id of the award.'),
})
  .description('Request object to cancel an award')
  .meta({
    className: 'AwardCancelRequest',
  });
