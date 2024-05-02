import { AwardCancelRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const awardCancelSchema = toJoiObject<AwardCancelRequest>({
  uid: CommonJoi.uid().description('Buildcore id of the award.'),
})
  .description('Request object to cancel an award')
  .meta({
    className: 'AwardCancelRequest',
  });
