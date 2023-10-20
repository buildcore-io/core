import { NftBidRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const nftBidSchema = toJoiObject<NftBidRequest>({
  nft: CommonJoi.uid().description('Build5 id of the nft.'),
})
  .description('Request object to create an NFT bid order.')
  .meta({
    className: 'NftBidRequest',
  });
