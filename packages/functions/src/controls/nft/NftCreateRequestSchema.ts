import { MAX_IOTA_AMOUNT, MIN_IOTA_AMOUNT, NftCreateRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const createSchema = {
  name: Joi.string().allow(null, '').required().description('Name of the nft'),
  description: Joi.string().allow(null, '').required().description('Description of the nft.'),
  collection: CommonJoi.uid().description('Buildcore id of the collection for this nft.'),
  media: CommonJoi.storageUrl(false).description('BUILD.5 url pointing to an nft image or video.'),
  availableFrom: Joi.date().required().description("Starting date of the nft's availability."),
  price: Joi.number()
    .min(MIN_IOTA_AMOUNT)
    .max(MAX_IOTA_AMOUNT)
    .required()
    .description(`Price of the nft. Minimum ${MIN_IOTA_AMOUNT}, maximum ${MAX_IOTA_AMOUNT}`),
  url: Joi.string()
    .allow(null, '')
    .uri({
      scheme: ['https', 'http'],
    })
    .optional()
    .description('Url description for the nft.'),
  properties: Joi.object().optional().description('Property object of the nft'),
  stats: Joi.object().optional().description('Stat object of the nft'),
  saleAccessMembers: Joi.array()
    .items(CommonJoi.uid(false))
    .optional()
    .description('If present only these members can buy the nft.'),
};
export const nftCreateSchema = toJoiObject<NftCreateRequest>(createSchema)
  .description('Request object to create an NFT')
  .meta({
    className: 'NftCreateRequest',
  });
