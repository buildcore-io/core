import { SwapRejectRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const swapRejectSchema = toJoiObject<SwapRejectRequest>({
  uid: CommonJoi.uid().description('Buildcore UID of the swap'),
})
  .description('Request object to reject a swap.')
  .meta({ className: 'SwapRejectRequest' });
