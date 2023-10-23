import { NftPurchaseRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const nftPurchaseSchema = toJoiObject<NftPurchaseRequest>({
  collection: CommonJoi.uid().description(
    'Build5 id of the collection in case a random nft is bought.',
  ),
  nft: CommonJoi.uid(false).description('Build5 if of the nft to be purchased.'),
})
  .description('Request object to create an NFT purchase order')
  .meta({
    className: 'NftPurchaseRequest',
  });
