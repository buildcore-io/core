import { AwardRejectRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';

export const awardRejectSchema = toJoiObject<AwardRejectRequest>({
  uid: CommonJoi.uid().description('Build5 id of the award.'),
})
  .description('Request object to reject an award')
  .meta({
    className: 'AwardRejectRequest',
  });
