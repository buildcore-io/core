import { NftWithdrawRequest } from '@build-5/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const nftWithdrawSchema = toJoiObject<NftWithdrawRequest>({
  nft: CommonJoi.uid().description('Build5 id of the nft to withdraw.'),
})
  .description('Request object to withdraw an NFT.')
  .meta({
    className: 'NftWithdrawRequest',
  });
