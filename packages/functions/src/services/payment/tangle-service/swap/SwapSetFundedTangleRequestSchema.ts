import { SwapSetFundedTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const swapSetFundedTangleSchema = toJoiObject<SwapSetFundedTangleRequest>({
  ...baseTangleSchema(TangleRequestType.SET_SWAP_FUNDED),
  uid: CommonJoi.uid().description('Buildcore UID of the swap'),
})
  .description('Tangle request object to set swap as funded.')
  .meta({
    className: 'SwapSetFundedTangleRequest',
  });
