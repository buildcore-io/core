import { OrderTokenRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../../services/joi/common';

export const orderTokenSchema = toJoiObject<OrderTokenRequest>({
  token: CommonJoi.uid().description('Build5 id of the token'),
})
  .description('Request object to create a token purchase order.')
  .meta({
    className: 'OrderTokenRequest',
  });
