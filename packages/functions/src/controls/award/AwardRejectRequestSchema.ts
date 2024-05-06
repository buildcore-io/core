import { AwardRejectRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const awardRejectSchema = toJoiObject<AwardRejectRequest>({
  uid: CommonJoi.uid().description('Buildcore id of the award.'),
})
  .description('Request object to reject an award')
  .meta({
    className: 'AwardRejectRequest',
  });
