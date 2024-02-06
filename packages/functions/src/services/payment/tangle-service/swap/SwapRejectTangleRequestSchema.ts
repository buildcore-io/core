import { SwapRejectTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const swapRejectTangleSchema = toJoiObject<SwapRejectTangleRequest>({
  ...baseTangleSchema(TangleRequestType.REJECT_SWAP),
  uid: CommonJoi.uid().description('Build5 UID of the swap'),
})
  .description('Tangle request object to set swap as funded.')
  .meta({
    className: 'SwapRejectTangleRequest',
  });
