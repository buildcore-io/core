import { NftWithdrawRequest } from '@buildcore/interfaces';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const nftWithdrawSchema = toJoiObject<NftWithdrawRequest>({
  nft: CommonJoi.uid().description('Buildcore id of the nft to withdraw.'),
})
  .description('Request object to withdraw an NFT.')
  .meta({
    className: 'NftWithdrawRequest',
  });
