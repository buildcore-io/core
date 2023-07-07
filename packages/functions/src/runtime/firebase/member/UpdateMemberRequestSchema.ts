import {
  DISCORD_REGEXP,
  GITHUB_REGEXP,
  MemberUpdateRequest,
  TWITTER_REGEXP,
} from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';

export const updateMemberSchema = toJoiObject<MemberUpdateRequest>({
  name: Joi.string().allow(null, '').optional().description('Name of the member'),
  about: Joi.string().allow(null, '').optional().description('Information about the member'),
  discord: Joi.string()
    .allow(null, '')
    .regex(DISCORD_REGEXP)
    .optional()
    .description('Discord url of the member'),
  github: Joi.string()
    .allow(null, '')
    .regex(GITHUB_REGEXP)
    .optional()
    .description('Github url of the member'),
  twitter: Joi.string()
    .allow(null, '')
    .regex(TWITTER_REGEXP)
    .optional()
    .description('Twitter url of the member'),
  avatarNft: CommonJoi.uid(false).description('Build5 id of the nft to be used as an avatar'),
  avatar: CommonJoi.uid(false).description('Build5 id of the avatar to be used for this member'),
})
  .description('Request object to update a member')
  .meta({
    className: 'MemberUpdateRequest',
  });
