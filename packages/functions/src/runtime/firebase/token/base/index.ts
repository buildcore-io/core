import {
  Access,
  MAX_IOTA_AMOUNT,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_IOTA_AMOUNT,
  MIN_TOKEN_START_DATE_DAY,
  MIN_TOTAL_TOKEN_SUPPLY,
  TokenAllocation,
  TRANSACTION_AUTO_EXPIRY_MS,
  TRANSACTION_MAX_EXPIRY_MS,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { cancelPublicSaleControl } from '../../../../controls/token/token.cancel.pub.sale';
import { createTokenControl } from '../../../../controls/token/token.create';
import { creditTokenControl } from '../../../../controls/token/token.credit';
import { enableTokenTradingControl } from '../../../../controls/token/token.enable.trading';
import { orderTokenControl } from '../../../../controls/token/token.order';
import { setTokenAvailableForSaleControl } from '../../../../controls/token/token.set.for.sale';
import { updateTokenControl } from '../../../../controls/token/token.update';
import { onCall } from '../../../../firebase/functions/onCall';
import { CommonJoi } from '../../../../services/joi/common';
import { isProdEnv } from '../../../../utils/config.utils';
import { uidSchema } from '../../common';

const createTokenSchema = Joi.object({
  name: Joi.string().required(),
  symbol: CommonJoi.tokenSymbol(),
  title: Joi.string().optional(),
  description: Joi.string().optional(),
  shortDescriptionTitle: Joi.string().optional(),
  shortDescription: Joi.string().optional(),
  space: CommonJoi.uid(),
  pricePerToken: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).optional(),
  totalSupply: Joi.number()
    .required()
    .min(MIN_TOTAL_TOKEN_SUPPLY)
    .max(MAX_TOTAL_TOKEN_SUPPLY)
    .integer()
    .unsafe(),
  allocations: Joi.array()
    .required()
    .items(
      Joi.object().keys({
        title: Joi.string().required(),
        percentage: Joi.number().min(0.01).max(100).precision(2).required(),
        isPublicSale: Joi.boolean().optional(),
      }),
    )
    .min(1)
    .custom((allocations: TokenAllocation[], helpers) => {
      const publicSaleCount = allocations.filter((a) => a.isPublicSale).length;
      if (publicSaleCount > 1) {
        return helpers.error('Only one public sale is allowed');
      }
      const total = allocations.reduce((acc, act) => acc + act.percentage, 0);
      if (total !== 100) {
        return helpers.error('Allocations percentage sum must be 100');
      }
      return allocations;
    }),
  // Only on prod we enforce 7 days.
  saleStartDate: Joi.date()
    .greater(
      dayjs()
        .add(isProdEnv() ? MIN_TOKEN_START_DATE_DAY : 0, 'd')
        .toDate(),
    )
    .optional(),
  saleLength: Joi.number()
    .min(TRANSACTION_AUTO_EXPIRY_MS)
    .max(TRANSACTION_MAX_EXPIRY_MS)
    .optional(),
  coolDownLength: Joi.number().min(0).max(TRANSACTION_MAX_EXPIRY_MS).optional(),
  autoProcessAt100Percent: Joi.boolean().optional(),
  links: Joi.array().min(0).items(Joi.string().uri()),
  icon: CommonJoi.storageUrl(),
  overviewGraphics: CommonJoi.storageUrl(),
  termsAndConditions: Joi.string().uri().required(),
  access: Joi.number()
    .equal(...Object.values(Access))
    .required(),
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
  tradingDisabled: Joi.boolean().allow(true, false).optional(),
});

export const createToken = onCall(WEN_FUNC.cToken)(createTokenSchema, createTokenControl);

const updateTokenSchema = Joi.object({
  name: Joi.string().required().allow(null, ''),
  title: Joi.string().required().allow(null, ''),
  description: Joi.string().required().allow(null, ''),
  shortDescriptionTitle: Joi.string().required().allow(null, ''),
  shortDescription: Joi.string().required().allow(null, ''),
  links: Joi.array().min(0).items(Joi.string().uri()),
  uid: CommonJoi.uid(),
  pricePerToken: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).optional(),
});

export const updateToken = onCall(WEN_FUNC.uToken)(updateTokenSchema, updateTokenControl);

const setAvailableForSaleSchema = Joi.object({
  token: CommonJoi.uid(),
  saleStartDate: Joi.date()
    .greater(
      dayjs()
        .add(isProdEnv() ? MIN_TOKEN_START_DATE_DAY : 0, 'd')
        .toDate(),
    )
    .required(),
  saleLength: Joi.number()
    .min(TRANSACTION_AUTO_EXPIRY_MS)
    .max(TRANSACTION_MAX_EXPIRY_MS)
    .required(),
  coolDownLength: Joi.number().min(0).max(TRANSACTION_MAX_EXPIRY_MS).required(),
  autoProcessAt100Percent: Joi.boolean().optional(),
  pricePerToken: Joi.number().min(0.001).max(MAX_IOTA_AMOUNT).precision(3).required(),
});

export const setTokenAvailableForSale = onCall(WEN_FUNC.setTokenAvailableForSale)(
  setAvailableForSaleSchema,
  setTokenAvailableForSaleControl,
);

const tokenUidSchema = Joi.object({ token: CommonJoi.uid() });
export const cancelPublicSale = onCall(WEN_FUNC.cancelPublicSale)(
  tokenUidSchema,
  cancelPublicSaleControl,
);

const creditTokenSchema = Joi.object({
  token: CommonJoi.uid(),
  amount: Joi.number().min(MIN_IOTA_AMOUNT).max(MAX_IOTA_AMOUNT).required(),
});
export const creditToken = onCall(WEN_FUNC.creditToken)(creditTokenSchema, creditTokenControl);

export const orderToken = onCall(WEN_FUNC.orderToken)(tokenUidSchema, orderTokenControl);

export const enableTokenTrading = onCall(WEN_FUNC.enableTokenTrading)(
  uidSchema,
  enableTokenTradingControl,
);
