import { NftDepositTangleRequest } from '@build-5/interfaces';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const despotNftSchema = toJoiObject<NftDepositTangleRequest>(baseTangleSchema)
  .description('Tangle request object to create an nft deposit order.')
  .meta({
    className: 'NftDepositTangleRequest',
  });
