import { SwapSetFundedTangleRequest, TangleRequestType } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const swapSetFundedTangleSchema = toJoiObject<SwapSetFundedTangleRequest>({
  ...baseTangleSchema(TangleRequestType.SET_SWAP_FUNDED),
  uid: CommonJoi.uid().description('Build5 UID of the swap'),
})
  .description('Tangle request object to set swap as funded.')
  .meta({
    className: 'SwapSetFundedTangleRequest',
  });
