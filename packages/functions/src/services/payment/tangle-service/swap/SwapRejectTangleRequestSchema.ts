import { SwapRejectTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const swapRejectTangleSchema = toJoiObject<SwapRejectTangleRequest>({
  ...baseTangleSchema(TangleRequestType.REJECT_SWAP),
  uid: CommonJoi.uid().description('Buildcore UID of the swap'),
})
  .description('Tangle request object to set swap as funded.')
  .meta({
    className: 'SwapRejectTangleRequest',
  });
