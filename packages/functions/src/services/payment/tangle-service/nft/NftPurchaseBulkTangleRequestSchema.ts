import {
  MAX_NFT_BULK_PURCHASE,
  NftPurchaseBulkTangleRequest,
  TangleRequestType,
} from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../joi/common';
import { baseTangleSchema } from '../common';

const nftPurchaseSchema = Joi.object({
  collection: CommonJoi.uid().description(
    'Build5 id of the collection in case a random nft is bought.',
  ),
  nft: CommonJoi.uid(false).description('Build5 id of the nft to be purchased.'),
});

export const nftPurchaseBulkSchema = toJoiObject<NftPurchaseBulkTangleRequest>({
  ...baseTangleSchema(TangleRequestType.NFT_PURCHASE_BULK),
  orders: Joi.array()
    .items(nftPurchaseSchema)
    .min(1)
    .max(MAX_NFT_BULK_PURCHASE)
    .description(
      `List of collections&nfts to purchase, minimum 1, maximum ${MAX_NFT_BULK_PURCHASE}`,
    )
    .required(),
  disableWithdraw: Joi.boolean().description(
    "If set to true, NFT will not be sent to the buyer's validated address upon purchase.",
  ),
})
  .description('Tangle request object to create an NFT bulk purchase order')
  .meta({
    className: 'NftPurchaseBulkTangleRequest',
  });
