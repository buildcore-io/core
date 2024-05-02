import { MAX_IOTA_AMOUNT, MIN_IOTA_AMOUNT, NftUpdateUnsoldRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const updateUnsoldNftSchema = toJoiObject<NftUpdateUnsoldRequest>({
  uid: CommonJoi.uid().description('Buildcore id of the nft to update'),
  price: Joi.number()
    .min(MIN_IOTA_AMOUNT)
    .max(MAX_IOTA_AMOUNT)
    .required()
    .description(`Price of the nft. Minimum ${MIN_IOTA_AMOUNT}, maximum ${MAX_IOTA_AMOUNT}`),
})
  .description('Request object to update an unsold NFT')
  .meta({
    className: 'NftUpdateUnsoldRequest',
  });
