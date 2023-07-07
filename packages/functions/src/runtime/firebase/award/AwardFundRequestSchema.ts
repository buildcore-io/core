import { AwardFundRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';

export const awardFundSchema = toJoiObject<AwardFundRequest>({
  uid: CommonJoi.uid().description('Build5 id of the award.'),
})
  .description('Request object to create an award fund order')
  .meta({
    className: 'AwardFundRequest',
  });
