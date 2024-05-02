import { OrderTokenRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const orderTokenSchema = toJoiObject<OrderTokenRequest>({
  token: CommonJoi.uid().description('Buildcore id of the token'),
})
  .description('Request object to create a token purchase order.')
  .meta({
    className: 'OrderTokenRequest',
  });
