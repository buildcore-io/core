import { SwapSetFundedRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const swapFundedSchema = toJoiObject<SwapSetFundedRequest>({
  uid: CommonJoi.uid().description('Build5 UID of the swap'),
})
  .description('Request object to set a swap as funded.')
  .meta({ className: 'SwapSetFundedRequest' });
