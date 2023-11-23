import {
  Access,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_PRICE_PER_TOKEN,
  MIN_TOKEN_START_DATE_DAY,
  MIN_TOTAL_TOKEN_SUPPLY,
  TRANSACTION_AUTO_EXPIRY_MS,
  TRANSACTION_MAX_EXPIRY_MS,
  TokenAllocation,
  TokenCreateRequest,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { isProdEnv } from '../../utils/config.utils';
import { MAX_PRICE } from './common';

const MIN_PERCENTAGE = 0.01;
const MAX_PERCENTAGE = 100;

const MIN_COOL_DOWN = 0;

const MIN_DECIMALS = 0;
const MAX_DECIMALS = 20;

export const createTokenSchema = toJoiObject<TokenCreateRequest>({
  name: Joi.string().required().description('Name of the token.'),
  symbol: CommonJoi.tokenSymbol().description('Unique symbol of the token.'),
  title: Joi.string().optional().description('Title of the token.'),
  description: Joi.string().optional().description('Description of the token.'),
  shortDescriptionTitle: Joi.string()
    .optional()
    .description('Short description title of the token.'),
  shortDescription: Joi.string().optional().description('Short description of the token.'),
  space: CommonJoi.uid(false).description('Build5 id of the space.'),
  pricePerToken: Joi.number()
    .min(MIN_PRICE_PER_TOKEN)
    .max(MAX_PRICE)
    .precision(6)
    .optional()
    .description(`Price per token. Minimum ${MIN_PRICE_PER_TOKEN}, maximum ${MAX_PRICE}.`),
  totalSupply: Joi.number()
    .required()
    .min(MIN_TOTAL_TOKEN_SUPPLY)
    .max(MAX_TOTAL_TOKEN_SUPPLY)
    .integer()
    .unsafe()
    .description(
      `Total token supply. Minimum ${MIN_TOTAL_TOKEN_SUPPLY}, maximum ${MAX_TOTAL_TOKEN_SUPPLY}`,
    ),
  allocations: Joi.array()
    .required()
    .items(
      Joi.object().keys({
        title: Joi.string().required().description('Allocation name.'),
        percentage: Joi.number()
          .min(MIN_PERCENTAGE)
          .max(MAX_PERCENTAGE)
          .precision(2)
          .required()
          .description(
            `Percentage value of the allocaation. \n` +
              `Minimum ${MIN_PERCENTAGE}, maximum ${MAX_PERCENTAGE}. \n` +
              `The total percentage has to be 100`,
          ),
        isPublicSale: Joi.boolean()
          .optional()
          .description(
            'If true, this allocation is public. Only one public allocation is allowed.',
          ),
      }),
    )
    .min(1)
    .custom((allocations: TokenAllocation[], helpers) => {
      const publicSaleCount = allocations.filter((a) => a.isPublicSale).length;
      if (publicSaleCount > 1) {
        return helpers.error('array.unique', { message: 'Only one public sale is allowed' });
      }
      const total = allocations.reduce((acc, act) => acc + act.percentage, 0);
      if (total !== 100) {
        return helpers.error('any.invalid', { message: 'Allocations percentage sum must be 100' });
      }
      return allocations;
    })
    .description('Token supply allocations.'),
  // Only on prod we enforce 7 days.
  saleStartDate: Joi.date()
    .greater(
      dayjs()
        .add(isProdEnv() ? MIN_TOKEN_START_DATE_DAY : 0, 'd')
        .toDate(),
    )
    .optional()
    .description(
      `Starting date of the token sale. Has to be ${MIN_TOKEN_START_DATE_DAY} days in the future.`,
    ),
  saleLength: Joi.number()
    .min(TRANSACTION_AUTO_EXPIRY_MS)
    .max(TRANSACTION_MAX_EXPIRY_MS)
    .optional()
    .description(
      `Length of the sale in milliseconds. Minimum ${TRANSACTION_AUTO_EXPIRY_MS}, maximum ${TRANSACTION_MAX_EXPIRY_MS}`,
    ),
  coolDownLength: Joi.number()
    .min(MIN_COOL_DOWN)
    .max(TRANSACTION_MAX_EXPIRY_MS)
    .optional()
    .description(
      `Length of the cool down period. Minimum ${MIN_COOL_DOWN}, maximum ${TRANSACTION_MAX_EXPIRY_MS}`,
    ),
  autoProcessAt100Percent: Joi.boolean()
    .optional()
    .description('If true, purchases will be fullfilled once reuqest reach 100%.'),
  links: Joi.array().min(0).items(Joi.string().uri()).description('Usefull links for the token.'),
  icon: CommonJoi.storageUrl().description('Build5 url pointing to the token icon.'),
  overviewGraphics: CommonJoi.storageUrl().description(
    'Build5 url pointing to the overview graphics of the token.',
  ),
  termsAndConditions: Joi.string()
    .uri()
    .required()
    .description('Terms and conditions of the token.'),
  access: Joi.number()
    .equal(...Object.values(Access).filter((v) => typeof v === 'number'))
    .required()
    .description('Access type of the token'),
  accessAwards: Joi.array()
    .when('access', {
      is: Joi.exist().valid(Access.MEMBERS_WITH_BADGE),
      then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
      otherwise: Joi.forbidden(),
    })
    .description(
      'Build5 id of the awards. If present only members with the given awards can purchase this token.',
    ),
  accessCollections: Joi.array()
    .when('access', {
      is: Joi.exist().valid(Access.MEMBERS_WITH_NFT_FROM_COLLECTION),
      then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
      otherwise: Joi.forbidden(),
    })
    .description(
      'Build5 id of the collections. If present only members having NFTs from the give collections can purchase this token.',
    ),
  tradingDisabled: Joi.boolean()
    .allow(true, false)
    .optional()
    .description('If true, trading is disabled for this token.'),
  decimals: Joi.number()
    .integer()
    .min(0)
    .max(20)
    .required()
    .description(`Decimal value for the token. Minimum ${MIN_DECIMALS}, maximum ${MAX_DECIMALS}.`),
})
  .description('Request object to create a token.')
  .meta({
    className: 'TokenCreateRequest',
  });
