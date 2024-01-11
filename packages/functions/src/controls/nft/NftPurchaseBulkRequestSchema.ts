import { MAX_NFT_BULK_PURCHASE, NftPurchaseBulkRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { toJoiObject } from '../../services/joi/common';
import { nftPurchaseSchema } from './NftPurchaseRequestSchema';

export const nftPurchaseBulkSchema = toJoiObject<NftPurchaseBulkRequest>({
  orders: Joi.array()
    .items(nftPurchaseSchema)
    .min(1)
    .max(MAX_NFT_BULK_PURCHASE)
    .description(
      `List of collections&nfts to purchase, minimum 1, maximum ${MAX_NFT_BULK_PURCHASE}`,
    )
    .required(),
})
  .description('Request object to create an NFT bulk purchase order')
  .meta({
    className: 'NftPurchaseBulkRequest',
  });
