import { DISCORD_REGEXP, GITHUB_REGEXP, TWITTER_REGEXP, WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { createMemberControl } from '../../../controls/member/member.create';
import { updateMemberControl } from '../../../controls/member/member.update';
import { onCall } from '../../../firebase/functions/onCall';
import { CommonJoi } from '../../../services/joi/common';

export const updateMemberSchema = Joi.object({
  name: Joi.string().allow(null, '').optional(),
  about: Joi.string().allow(null, '').optional(),
  discord: Joi.string().allow(null, '').regex(DISCORD_REGEXP).optional(),
  github: Joi.string().allow(null, '').regex(GITHUB_REGEXP).optional(),
  twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional(),
  avatarNft: CommonJoi.uid(false),
});

export const createMember = onCall(WEN_FUNC.cMemberNotExists)(Joi.object({}), createMemberControl);

export const updateMember = onCall(WEN_FUNC.uMember)(updateMemberSchema, updateMemberControl);
