import {
  Access,
  Categories,
  CollectionType,
  CreateCollectionRequest,
  MAX_IOTA_AMOUNT,
  MIN_IOTA_AMOUNT,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { availableFromMinMinutes } from './CollectionUpdateMintedRequestSchema';
import { updateCollectionSchema } from './CollectionUpdateRequestSchema';

// eslint-disable-next-line  @typescript-eslint/no-unused-vars
const { uid, ...updateCollectionSchemaRest } = updateCollectionSchema;

export const createCollectionSchema = toJoiObject<CreateCollectionRequest>({
  ...updateCollectionSchemaRest,
  type: Joi.number()
    .equal(CollectionType.CLASSIC, CollectionType.GENERATED, CollectionType.SFT)
    .required()
    .description('Type of the collection.'),
  space: CommonJoi.uid().description('Build5 id of the space for this collection.'),
  price: Joi.number()
    .min(MIN_IOTA_AMOUNT)
    .max(MAX_IOTA_AMOUNT)
    .required()
    .description(
      `Price of the collection. Minimum ${MIN_IOTA_AMOUNT}, maximum ${MAX_IOTA_AMOUNT}.`,
    ),
  access: Joi.number()
    .equal(...Object.values(Access).filter((v) => typeof v === 'number'))
    .required()
    .description('Access type of the collection'),
  // On test we allow now.
  availableFrom: Joi.date()
    .greater(dayjs().subtract(availableFromMinMinutes, 'minutes').toDate())
    .optional()
    .description(
      `The collections available from data. It can be maximum ${availableFromMinMinutes} minutes in the past.`,
    ),
  category: Joi.string()
    .equal(...Object.keys(Categories))
    .required()
    .description('Category of the collection.'),
  limitedEdition: Joi.boolean()
    .optional()
    .description('If true, the collection is limited, it can have a limited number of NFTs.'),
})
  .description('Request object to create a collection.')
  .meta({
    className: 'CreateCollectionRequest',
  });
