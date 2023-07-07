import { NftPurchaseTangleRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const nftPurchaseSchema = toJoiObject<NftPurchaseTangleRequest>({
  ...baseTangleSchema,
  collection: CommonJoi.uid().description(
    'Build5 id of the collection in case a random nft is bought.',
  ),
  nft: CommonJoi.uid(false).description('Build5 if of the nft to be purchased.'),
})
  .description('Tangle request object to create an NFT purchase order')
  .meta({
    className: 'NftPurchaseTangleRequest',
  });
