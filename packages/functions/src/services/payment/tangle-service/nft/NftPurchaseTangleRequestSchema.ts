import { NftPurchaseTangleRequest, TangleRequestType } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

export const nftPurchaseSchema = toJoiObject<NftPurchaseTangleRequest>({
  ...baseTangleSchema(TangleRequestType.NFT_PURCHASE),
  collection: CommonJoi.uid().description(
    'Buildcore id of the collection in case a random nft is bought.',
  ),
  nft: CommonJoi.uid(false).description('Buildcore id of the nft to be purchased.'),
  disableWithdraw: Joi.boolean().description(
    "If set to true, NFT will not be sent to the buyer's validated address upon purchase.",
  ),
})
  .description('Tangle request object to create an NFT purchase order')
  .meta({
    className: 'NftPurchaseTangleRequest',
  });
