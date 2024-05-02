import { NftSetForSaleTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import { baseNftSetForSaleSchema } from '../../../../controls/nft/NftSetForSaleRequestSchema';
import { toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const setNftForSaleTangleSchema = toJoiObject<NftSetForSaleTangleRequest>({
  ...baseTangleSchema(TangleRequestType.NFT_SET_FOR_SALE),
  ...baseNftSetForSaleSchema,
})
  .description('Tangle request object to set an NFT for sale.')
  .meta({
    className: 'NftSetForSaleTangleRequest',
  });
