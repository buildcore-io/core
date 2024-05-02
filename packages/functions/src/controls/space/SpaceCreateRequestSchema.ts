import { GITHUB_REGEXP, SpaceCreateRequest, TWITTER_REGEXP } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';

export const createSpaceSchema = {
  name: Joi.string().allow(null, '').optional().description('Name of the space.'),
  about: Joi.string().allow(null, '').optional().description('Information about the space.'),
  open: Joi.boolean()
    .allow(false, true)
    .optional()
    .description('If true, anyone can instantly join this space.'),
  discord: Joi.string()
    .allow(null, '')
    .alphanum()
    .optional()
    .description('Discord url of the space.'),
  github: Joi.string()
    .allow(null, '')
    .regex(GITHUB_REGEXP)
    .optional()
    .description('Github url of ths space'),
  twitter: Joi.string()
    .allow(null, '')
    .regex(TWITTER_REGEXP)
    .optional()
    .description('Twitter url of ths space'),
  avatarUrl: CommonJoi.storageUrl(false).description('Avatar url of ths space'),
  bannerUrl: CommonJoi.storageUrl(false).description('Banner url of ths space'),
};

export const createSpaceSchemaObject = toJoiObject<SpaceCreateRequest>(createSpaceSchema)
  .description('Request object to create a space.')
  .meta({
    className: 'SpaceCreateRequest',
  });
