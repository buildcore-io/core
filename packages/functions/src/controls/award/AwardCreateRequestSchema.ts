import { AwardCreateBadgeRequest, AwardCreateRequest, MAX_IOTA_AMOUNT } from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { AVAILABLE_NETWORKS } from '../common';

const MIN_TOTAL_BADGES = 1;
const MAX_TOTAL_BADGES = 10000;

export const awardBageSchema = {
  name: Joi.string().required().description('Name of the badge'),
  description: Joi.string().allow(null, '').optional().description('Description of the badge'),
  total: Joi.number()
    .min(MIN_TOTAL_BADGES)
    .max(MAX_TOTAL_BADGES)
    .integer()
    .required()
    .description(
      `Total noumber of bages that can be issued. Minimum ${MIN_TOTAL_BADGES}, maximum ${MAX_TOTAL_BADGES}`,
    ),
  image: CommonJoi.storageUrl().description('An https url pointing to a soonaverse image.'),
  tokenReward: Joi.number()
    .min(0)
    .max(MAX_IOTA_AMOUNT)
    .integer()
    .required()
    .description('The amount of token rewarded with this badge.'),
  tokenSymbol: CommonJoi.tokenSymbol().description('The symbol of the reward token.'),
  lockTime: Joi.number()
    .min(0)
    .max((Math.pow(2, 32) - dayjs().unix() - 1) * 1000)
    .integer()
    .required()
    .description('The time for which the reward nft will be locked.'),
};

export const awardBageSchemaObject = toJoiObject<AwardCreateBadgeRequest>(awardBageSchema)
  .description('Object representing a badge')
  .meta({
    className: 'AwardCreateBadgeRequest',
  });

export const awardCreateSchema = {
  name: Joi.string().required().description('Name of the award'),
  description: Joi.string().allow(null, '').optional().description('Description of the award'),
  space: CommonJoi.uid().description('Build5 id of the space'),
  endDate: Joi.date().required().description('End date of the award issuing period.'),
  badge: awardBageSchemaObject,
  network: Joi.string()
    .equal(...AVAILABLE_NETWORKS)
    .required()
    .description('Network on which the award will be minted and issued'),
};

export const awardCreateSchemaObject = toJoiObject<AwardCreateRequest>(awardCreateSchema)
  .description('Request object to create an award')
  .meta({
    className: 'AwardCreateRequest',
  });
