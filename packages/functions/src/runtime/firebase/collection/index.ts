import {
  Access,
  Categories,
  CollectionType,
  DISCORD_REGEXP,
  MAX_IOTA_AMOUNT,
  MIN_IOTA_AMOUNT,
  NftAvailableFromDateMin,
  TWITTER_REGEXP,
  UnsoldMintingOptions,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { uniq } from 'lodash';
import { mintCollectionOrderControl } from '../../../controls/collection/collection-mint.control';
import { approveCollectionControl } from '../../../controls/collection/collection.approve.control';
import { createCollectionControl } from '../../../controls/collection/collection.create.control';
import { rejectCollectionControl } from '../../../controls/collection/collection.reject.control';
import { updateCollectionControl } from '../../../controls/collection/collection.update.control';
import { AVAILABLE_NETWORKS } from '../../../controls/common';
import { onCall } from '../../../firebase/functions/onCall';
import { CommonJoi } from '../../../services/joi/common';
import { isProdEnv, networks } from '../../../utils/config.utils';
import { uidSchema } from '../common';

export const updateMintedCollectionSchema = {
  discounts: Joi.array()
    .items(
      Joi.object().keys({
        tokenSymbol: CommonJoi.tokenSymbol(),
        tokenReward: Joi.number().integer().min(0).required(),
        amount: Joi.number().min(0.01).max(1).precision(2).required(),
      }),
    )
    .min(0)
    .max(5)
    .optional()
    .custom((discounts: { tokenReward: number }[], helpers) => {
      const unique = uniq(discounts.map((d) => d.tokenReward));
      if (unique.length !== discounts.length) {
        return helpers.error('Token reward must me unique');
      }
      return discounts;
    }),
  onePerMemberOnly: Joi.boolean().optional(),
  access: Joi.number()
    .equal(...Object.values(Access))
    .optional(),
  accessAwards: Joi.when('access', {
    is: Joi.exist().valid(Access.MEMBERS_WITH_BADGE),
    then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
    otherwise: Joi.forbidden(),
  }),
  accessCollections: Joi.when('access', {
    is: Joi.exist().valid(Access.MEMBERS_WITH_NFT_FROM_COLLECTION),
    then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
    otherwise: Joi.forbidden(),
  }),
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).optional(),
};

export const updateCollectionSchema = {
  ...updateMintedCollectionSchema,
  name: Joi.string().allow(null, '').required(),
  description: Joi.string().allow(null, '').required(),
  placeholderUrl: CommonJoi.storageUrl(false),
  bannerUrl: CommonJoi.storageUrl(false),
  royaltiesFee: Joi.number().min(0).max(1).required(),
  royaltiesSpace: CommonJoi.uid(),
  discord: Joi.string().allow(null, '').regex(DISCORD_REGEXP).optional(),
  url: Joi.string()
    .allow(null, '')
    .uri({
      scheme: ['https', 'http'],
    })
    .optional(),
  twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional(),
};

const createCollectionSchema = {
  ...updateCollectionSchema,
  type: Joi.number()
    .equal(CollectionType.CLASSIC, CollectionType.GENERATED, CollectionType.SFT)
    .required(),
  space: CommonJoi.uid(),
  price: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
  access: Joi.number()
    .equal(...Object.values(Access))
    .required(),
  // On test we allow now.
  availableFrom: Joi.date()
    .greater(
      dayjs()
        .add(isProdEnv() ? NftAvailableFromDateMin.value : -600000, 'ms')
        .toDate(),
    )
    .required(),
  category: Joi.number()
    .equal(...Object.keys(Categories))
    .required(),
  limitedEdition: Joi.boolean().optional(),
};

export const createCollection = onCall(WEN_FUNC.cCollection)(
  Joi.object(createCollectionSchema),
  createCollectionControl,
);

export const updateCollection = onCall(WEN_FUNC.uCollection)(
  uidSchema,
  updateCollectionControl,
  true,
);

export const approveCollection = onCall(WEN_FUNC.approveCollection)(
  uidSchema,
  approveCollectionControl,
);
export const rejectCollection = onCall(WEN_FUNC.rejectCollection)(
  uidSchema,
  rejectCollectionControl,
);

const availaibleNetworks = AVAILABLE_NETWORKS.filter((n) => networks.includes(n));
const mintCollectionSchema = Joi.object({
  collection: CommonJoi.uid(),
  network: Joi.string()
    .equal(...availaibleNetworks)
    .required(),
  unsoldMintingOptions: Joi.string()
    .equal(...Object.values(UnsoldMintingOptions))
    .required(),
  price: Joi.when('unsoldMintingOptions', {
    is: Joi.exist().valid(UnsoldMintingOptions.SET_NEW_PRICE),
    then: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).integer().required(),
  }),
});

export const mintCollection = onCall(WEN_FUNC.mintCollection, {
  memory: '8GB',
  timeoutSeconds: 540,
})(mintCollectionSchema, mintCollectionOrderControl);
