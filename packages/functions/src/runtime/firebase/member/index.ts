import {
  DISCORD_REGEXP,
  GITHUB_REGEXP,
  TWITTER_REGEXP,
  WenError,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { createMemberControl } from '../../../controls/member/member.create';
import { updateMemberControl } from '../../../controls/member/member.update';
import { onCall } from '../../../firebase/functions/onCall';
import { scale } from '../../../scale.settings';
import { CommonJoi } from '../../../services/joi/common';
import { throwUnAuthenticated } from '../../../utils/error.utils';
import { appCheck } from '../../../utils/google.utils';
import { assertValidationAsync } from '../../../utils/schema.utils';

export const updateMemberSchema = Joi.object({
  name: Joi.string().allow(null, '').optional(),
  about: Joi.string().allow(null, '').optional(),
  discord: Joi.string().allow(null, '').regex(DISCORD_REGEXP).optional(),
  github: Joi.string().allow(null, '').regex(GITHUB_REGEXP).optional(),
  twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional(),
  avatarNft: CommonJoi.uid(false),
});

export const createMember = functions
  .runWith({ minInstances: scale(WEN_FUNC.cMemberNotExists) })
  .https.onCall(async (address: string, context: functions.https.CallableContext) => {
    appCheck(WEN_FUNC.cMemberNotExists, context);
    try {
      await assertValidationAsync(Joi.object({ address: CommonJoi.uid() }), { address });
    } catch {
      throw throwUnAuthenticated(WenError.address_must_be_provided);
    }
    return await createMemberControl(address);
  });

export const updateMember = onCall(WEN_FUNC.uMember)(updateMemberSchema, updateMemberControl);
