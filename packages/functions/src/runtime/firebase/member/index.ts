import {
  DISCORD_REGEXP,
  GITHUB_REGEXP,
  TWITTER_REGEXP,
  WEN_FUNC,
  WenError,
} from '@soonaverse/interfaces';
import cors from 'cors';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { createMemberControl } from '../../../controls/member/member.create';
import { updateMemberControl } from '../../../controls/member/member.update';
import { getConfig, onRequest } from '../../../firebase/functions/onRequest';
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
  getConfig(WEN_FUNC.createMember),
  (req, res) =>
    cors({ origin: true })(req, res, async () => {
      // Set cors.
      res.set('Access-Control-Allow-Origin', '*');

      try {
        const address = req.body.data;
        const schema = Joi.object({ address: CommonJoi.uid() });
        await assertValidationAsync(schema, { address });
        res.send({ data: await createMemberControl(address) });
      } catch {
        res.status(401);
        res.send({ data: WenError.address_must_be_provided });
      }
    }),
);

export const updateMember = onRequest(WEN_FUNC.updateMember)(
  updateMemberSchema,
  updateMemberControl,
);
