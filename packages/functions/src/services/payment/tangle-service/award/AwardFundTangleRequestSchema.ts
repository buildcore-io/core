import { AwardFundTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const awardFundSchema = toJoiObject<AwardFundTangleRequest>({
  ...baseTangleSchema(TangleRequestType.AWARD_FUND),
  uid: CommonJoi.uid().description('Build5 id of the award.'),
})
  .description('Tangle request object to fund an award')
  .meta({
    className: 'AwardFundTangleRequest',
  });
