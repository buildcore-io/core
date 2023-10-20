import {
  Access,
  MAX_IOTA_AMOUNT,
  MIN_IOTA_AMOUNT,
  UpdateMintedCollectionRequest,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { uniq } from 'lodash';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

const MIN_DISCOUNTS = 0;
const MAX_DISCOUNTS = 5;

const MIN_DISCOUNT_AMOUNT = 0.01;
const MAX_DISCOUNT_AMOUNT = 1;

export const availableFromMinMinutes = 10;

export const updateMintedCollectionSchema = {
  uid: CommonJoi.uid().description('Build5 id of the collection.'),
  discounts: Joi.array()
    .items(
      Joi.object()
        .keys({
          tokenSymbol: CommonJoi.tokenSymbol().description('Symbol of the token.'),
          tokenReward: Joi.number()
            .integer()
            .min(0)
            .required()
            .description('Token amount to be rewarded, minimum 0. This must be unique.'),
          amount: Joi.number()
            .min(MIN_DISCOUNT_AMOUNT)
            .max(MAX_DISCOUNT_AMOUNT)
            .precision(2)
            .required()
            .description(
              `Amount of the discount to be applied. Minimum ${MIN_DISCOUNT_AMOUNT}, maximum ${MAX_DISCOUNT_AMOUNT}.`,
            ),
        })
        .description('Discount object.'),
    )
    .min(MIN_DISCOUNTS)
    .max(MAX_DISCOUNTS)
    .optional()
    .custom((discounts: { tokenReward: number }[], helpers) => {
      const unique = uniq(discounts.map((d) => d.tokenReward));
      if (unique.length !== discounts.length) {
        return helpers.error('array.unique', { message: 'Token reward must me unique' });
      }
      return discounts;
    })
    .description(`Array of discounts. Minimum ${MIN_DISCOUNTS}, maximum ${MAX_DISCOUNTS}.`),
  onePerMemberOnly: Joi.boolean()
    .optional()
    .description('If true, only on NFT can be owned per member from this collection.'),
  access: Joi.number()
    .equal(...Object.values(Access).filter((v) => typeof v === 'number'))
    .optional()
    .description('Access type of the collection.'),
  accessAwards: Joi.array()
    .when('access', {
      is: Joi.exist().valid(Access.MEMBERS_WITH_BADGE),
      then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
      otherwise: Joi.forbidden(),
    })
    .description(
      'Build5 id of awards. If set, only members having the specified awards can access this collection.',
    ),
  accessCollections: Joi.array()
    .when('access', {
      is: Joi.exist().valid(Access.MEMBERS_WITH_NFT_FROM_COLLECTION),
      then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
      otherwise: Joi.forbidden(),
    })
    .description(
      'Build5 id of collections. If set, only members owning NFTs from the specified collection can access this collection.',
    ),
  price: Joi.number()
    .min(MIN_IOTA_AMOUNT)
    .max(MAX_IOTA_AMOUNT)
    .optional()
    .description(
      `Price of the collection. Minimum ${MIN_IOTA_AMOUNT}, maximum ${MAX_IOTA_AMOUNT}.`,
    ),
  availableFrom: Joi.date()
    .greater(dayjs().subtract(availableFromMinMinutes, 'minutes').toDate())
    .optional()
    .description(
      `The collections available from data. It can be maximum ${availableFromMinMinutes} minutes in the past.`,
    ),
};

export const updateMintedCollectionSchemaObject = toJoiObject<UpdateMintedCollectionRequest>(
  updateMintedCollectionSchema,
)
  .description('Request object to update a minted collection.')
  .meta({
    className: 'UpdateMintedCollectionRequest',
  });
