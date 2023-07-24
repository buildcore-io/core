import {
  CreateMemberRequest,
  DISCORD_REGEXP,
  GITHUB_REGEXP,
  MemberUpdateRequest,
  TWITTER_REGEXP,
  WEN_FUNC,
  WenError,
} from '@build-5/interfaces';
import cors from 'cors';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { createMemberControl } from '../../../controls/member/member.create';
import { updateMemberControl } from '../../../controls/member/member.update';
import { onRequest, onRequestConfig } from '../../../firebase/functions/onRequest';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';
import { assertValidationAsync } from '../../../utils/schema.utils';

export const updateMemberSchema = toJoiObject<MemberUpdateRequest>({
  name: Joi.string().allow(null, '').optional(),
  about: Joi.string().allow(null, '').optional(),
  discord: Joi.string().allow(null, '').regex(DISCORD_REGEXP).optional(),
  github: Joi.string().allow(null, '').regex(GITHUB_REGEXP).optional(),
  twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional(),
  avatarNft: CommonJoi.uid(false).allow(null),
  avatar: CommonJoi.uid(false).allow(null),
});

const createMemberSchema = toJoiObject<CreateMemberRequest>({ address: CommonJoi.uid() });

export const createMember = functions.https.onRequest(
  onRequestConfig(WEN_FUNC.createMember),
  (req, res) =>
    cors({ origin: true })(req, res, async () => {
      try {
        const address = req.body.data;
        await assertValidationAsync(createMemberSchema, { address });
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
