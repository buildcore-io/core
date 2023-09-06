import { AwardFundTangleRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const awardFundSchema = toJoiObject<AwardFundTangleRequest>({
  ...baseTangleSchema,
  uid: CommonJoi.uid().description('Build5 id of the award.'),
})
  .description('Tangle request object to fund an award')
  .meta({
    className: 'AwardFundTangleRequest',
  });
