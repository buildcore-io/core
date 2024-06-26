import { DISCORD_REGEXP, TWITTER_REGEXP, UpdateCollectionRequest } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { updateMintedCollectionSchema } from './CollectionUpdateMintedRequestSchema';

const MIN_ROYALTY_FEE = 0;
const MAX_ROYALTY_FEE = 1;
export const updateCollectionSchema = {
  ...updateMintedCollectionSchema,
  name: Joi.string().allow(null, '').required().description('Name of the collection.'),
  description: Joi.string()
    .allow(null, '')
    .required()
    .description('Description of the collection.'),
  placeholderUrl: CommonJoi.storageUrl(false).description('Placeholder url.'),
  bannerUrl: CommonJoi.storageUrl(false).description('Banner ulr.'),
  royaltiesFee: Joi.number()
    .min(0)
    .max(1)
    .required()
    .description(
      `Royalty fee for the collection. Minimum ${MIN_ROYALTY_FEE}, maximum ${MAX_ROYALTY_FEE}`,
    ),
  royaltiesSpace: Joi.string()
    .when('royaltiesFee', {
      is: Joi.number().greater(0),
      then: CommonJoi.uid(true),
      otherwise: CommonJoi.uid(false).allow(''),
    })
    .description('Buildcore id of the royalty space.'),
  discord: Joi.string()
    .allow(null, '')
    .regex(DISCORD_REGEXP)
    .optional()
    .description('Discord url of the collection.'),
  url: Joi.string()
    .allow(null, '')
    .uri({
      scheme: ['https', 'http'],
    })
    .optional()
    .description('Url for the collection.'),
  twitter: Joi.string()
    .allow(null, '')
    .regex(TWITTER_REGEXP)
    .optional()
    .description('Twitter url of the collection.'),
};

export const updateCollectionSchemaObject = toJoiObject<UpdateCollectionRequest>(
  updateCollectionSchema,
)
  .description('Request object to update a collection.')
  .meta({
    className: 'UpdateCollectionRequest',
  });
