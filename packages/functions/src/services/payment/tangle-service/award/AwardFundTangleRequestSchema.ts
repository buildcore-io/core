import { AwardFundTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const awardFundSchema = toJoiObject<AwardFundTangleRequest>({
  ...baseTangleSchema(TangleRequestType.AWARD_FUND),
  uid: CommonJoi.uid().description('Buildcore id of the award.'),
})
  .description('Tangle request object to fund an award')
  .meta({
    className: 'AwardFundTangleRequest',
  });
