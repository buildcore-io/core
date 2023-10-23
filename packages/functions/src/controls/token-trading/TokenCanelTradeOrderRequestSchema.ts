import { CancelTokenTradeOrderRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const cancelTradeOrderSchema = toJoiObject<CancelTokenTradeOrderRequest>({
  uid: CommonJoi.uid().description('Build5 id of the trade order.'),
})
  .description('Request object to cancel a token trade order.')
  .meta({
    className: 'CancelTokenTradeOrderRequest',
  });
