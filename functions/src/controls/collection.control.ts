import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { WenError } from '../../interfaces/errors';
import { DecodedToken, WEN_FUNC } from '../../interfaces/functions/index';
import { COL, WenRequest } from '../../interfaces/models/base';
import { scale } from "../scale.settings";
import { uOn } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { appCheck } from "../utils/google.utils";
import { keywords } from "../utils/keywords.utils";
import { assertValidation, getDefaultParams, pSchema } from "../utils/schema.utils";
import { cleanParams, decodeAuth } from "../utils/wallet.utils";
import { DISCORD_REGEXP, TWITTER_REGEXP } from './../../interfaces/config';
import { Member } from './../../interfaces/models/member';

function defaultJoiUpdateCreateSchema(): any {
  return merge(getDefaultParams(), {
    name: Joi.string().allow(null, '').optional(),
    about: Joi.string().allow(null, '').optional(),
    bannerUrl: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional(),
    discord: Joi.string().allow(null, '').regex(DISCORD_REGEXP).optional(),
    url: Joi.string().allow(null, '').uri({
      scheme: ['https', 'http']
    }).optional(),
    twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional()
  });
}

export const createCollection: functions.CloudFunction<Member> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: scale(WEN_FUNC.cCollection),
}).https.onCall(async (req: WenRequest, context: any): Promise<Member> => {
  appCheck(WEN_FUNC.cCollection, context);
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const address = params.address.toLowerCase();
  const schema: ObjectSchema<Member> = Joi.object(merge(defaultJoiUpdateCreateSchema(), {
    uid: Joi.string().equal(address).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  let docMember = await admin.firestore().collection(COL.MEMBER).doc(address).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  // Validate user name is not yet used.
  if (params.body.name) {
    const doc = await admin.firestore().collection(COL.MEMBER)
                .where('name', '==', params.body.name).where('uid', '!=', address).get();
    if (doc.size > 0) {
      throw throwInvalidArgument(WenError.member_username_exists);
    }
  }

  // TODO Add validation via SC they really own the NFT.
  if (params.body?.currentProfileImage) {
    const doc = await admin.firestore().collection(COL.AVATARS).doc(params.body?.currentProfileImage.metadata).get();
    if (!doc.exists) {
      throw throwInvalidArgument(WenError.nft_does_not_exists);
    }

    if (doc.data()!.available !== true) {
      throw throwInvalidArgument(WenError.nft_is_no_longer_available);
    }
  }

  if (params.body) {
    await admin.firestore().collection(COL.MEMBER).doc(address).update(keywords(uOn(pSchema(
      schema,
      cleanParams(params.body),
      ['currentProfileImage']
    ))));

    if (params.body?.currentProfileImage) {
      await admin.firestore().collection(COL.AVATARS).doc(params.body?.currentProfileImage.metadata).update({
        available: false
      });
    }
    // Load latest
    docMember = await admin.firestore().collection(COL.MEMBER).doc(address).get();
  }

  // Return member.
  return <Member>docMember.data();
});
