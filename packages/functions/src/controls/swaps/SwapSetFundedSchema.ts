import { SwapSetFundedRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const swapFundedSchema = toJoiObject<SwapSetFundedRequest>({
  uid: CommonJoi.uid().description('Buildcore UID of the swap'),
})
  .description('Request object to set a swap as funded.')
  .meta({ className: 'SwapSetFundedRequest' });
