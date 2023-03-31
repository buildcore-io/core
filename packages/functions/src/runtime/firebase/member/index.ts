import {
  DISCORD_REGEXP,
  GITHUB_REGEXP,
  TWITTER_REGEXP,
  WenError,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { createMemberControl } from '../../../controls/member/member.create';
import { updateMemberControl } from '../../../controls/member/member.update';
import { onRequest } from '../../../firebase/functions/onRequest';
import { scale } from '../../../scale.settings';
import { CommonJoi } from '../../../services/joi/common';
import { assertValidationAsync } from '../../../utils/schema.utils';
export const updateMemberSchema = Joi.object({
  name: Joi.string().allow(null, '').optional(),
  about: Joi.string().allow(null, '').optional(),
  discord: Joi.string().allow(null, '').regex(DISCORD_REGEXP).optional(),
  github: Joi.string().allow(null, '').regex(GITHUB_REGEXP).optional(),
  twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional(),
  avatarNft: CommonJoi.uid(false),
});

export const createMember = functions.https.onRequest(
  { minInstances: scale(WEN_FUNC.cMemberNotExists) },
  async (req, res) => {
    try {
      await assertValidationAsync(Joi.object({ address: CommonJoi.uid() }), { address: req.body });
      const member = await createMemberControl(req.body);
      res.send(member);
    } catch {
      res.status(401).send(WenError.address_must_be_provided);
    }
  },
);

export const updateMember = onRequest(WEN_FUNC.uMember)(updateMemberSchema, updateMemberControl);
