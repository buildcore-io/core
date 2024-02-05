import { SwapRejectRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const swapRejectSchema = toJoiObject<SwapRejectRequest>({
  uid: CommonJoi.uid().description('Build5 UID of the swap'),
})
  .description('Request object to reject a swap.')
  .meta({ className: 'SwapRejectRequest' });
