import { NftBidTangleRequest, TangleRequestType } from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const nftBidSchema = toJoiObject<NftBidTangleRequest>({
  ...baseTangleSchema(TangleRequestType.NFT_BID),
  nft: CommonJoi.uid().description('Build5 id of the nft to bid on.'),
  disableWithdraw: Joi.boolean().description(
    "If set to true, NFT will not be sent to the buyer's validated address upon purchase.",
  ),
})
  .description('Tangle request object to create an NFT bid')
  .meta({
    className: 'NftBidTangleRequest',
  });
