import { CanelPublicSaleRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../../services/joi/common';

export const cancelPubSaleSchema = toJoiObject<CanelPublicSaleRequest>({
  token: CommonJoi.uid().description('Build5 id of the token.'),
})
  .description('Request object to cancel token public sale.')
  .meta({
    className: 'CanelPublicSaleRequest',
  });
