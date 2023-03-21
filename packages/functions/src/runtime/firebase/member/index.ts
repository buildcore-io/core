import { DISCORD_REGEXP, GITHUB_REGEXP, TWITTER_REGEXP, WEN_FUNC } from '@soonaverse/interfaces';
import { cid } from 'is-ipfs';
import Joi from 'joi';
import { createMemberControl } from '../../../controls/member/member.create';
import { updateMemberControl } from '../../../controls/member/member.update';
import { onCall } from '../../../firebase/functions/onCall';

export const updateMemberSchema = Joi.object({
  name: Joi.string().allow(null, '').optional(),
  about: Joi.string().allow(null, '').optional(),
  currentProfileImage: Joi.object({
    metadata: Joi.string()
      .custom((value) => {
        return cid(value);
      })
      .required(),
    fileName: Joi.string().required(),
    original: Joi.string()
      .custom((value) => {
        return cid(value);
      })
      .required(),
    avatar: Joi.string()
      .custom((value) => {
        return cid(value);
      })
      .required(),
  }).optional(),
  discord: Joi.string().allow(null, '').regex(DISCORD_REGEXP).optional(),
  github: Joi.string().allow(null, '').regex(GITHUB_REGEXP).optional(),
  twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional(),
});

export const createMember = onCall(WEN_FUNC.cMemberNotExists)(Joi.object({}), createMemberControl);

export const updateMember = onCall(WEN_FUNC.uMember)(updateMemberSchema, updateMemberControl);
