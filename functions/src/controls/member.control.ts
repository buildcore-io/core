import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { cid } from 'is-ipfs';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { WenError } from '../../interfaces/errors';
import { DecodedToken, WEN_FUNC } from '../../interfaces/functions/index';
import { COL, WenRequest } from '../../interfaces/models/base';
import { scale } from "../scale.settings";
import { cOn, uOn } from "../utils/dateTime.utils";
import { throwInvalidArgument, throwUnAuthenticated } from "../utils/error.utils";
import { appCheck } from "../utils/google.utils";
import { keywords } from "../utils/keywords.utils";
import { assertValidation, getDefaultParams, pSchema } from "../utils/schema.utils";
import { cleanParams, decodeAuth, ethAddressLength } from "../utils/wallet.utils";
import { DISCORD_REGEXP, GITHUB_REGEXP, TWITTER_REGEXP } from './../../interfaces/config';
import { Member } from './../../interfaces/models/member';

function defaultJoiUpdateCreateSchema(): Member {
  return merge(getDefaultParams(), {
    name: Joi.string().allow(null, '').optional(),
    about: Joi.string().allow(null, '').optional(),
    currentProfileImage: Joi.object({
      metadata: Joi.string().custom((value) => {
        return cid(value);
      }).required(),
      fileName: Joi.string().required(),
      original: Joi.string().custom((value) => {
        return cid(value);
      }).required(),
      avatar: Joi.string().custom((value) => {
        return cid(value);
      }).required()
    }).optional(),
    discord: Joi.string().allow(null, '').regex(DISCORD_REGEXP).optional(),
    github: Joi.string().allow(null, '').regex(GITHUB_REGEXP).optional(),
    twitter: Joi.string().allow(null, '').regex(TWITTER_REGEXP).optional()
  });
}

export const createMember: functions.CloudFunction<Member> = functions.runWith({
  minInstances: scale(WEN_FUNC.cMemberNotExists),
}).https.onCall(async (address: string, context: any): Promise<Member> => {
  appCheck(WEN_FUNC.cMemberNotExists, context);
  if (!address || address.length !== ethAddressLength) {
    throw throwUnAuthenticated(WenError.address_must_be_provided);
  }

  let docMember = await admin.firestore().collection(COL.MEMBER).doc(address).get();
  const generatedNonce: string = Math.floor(Math.random() * 1000000).toString();
  if (!docMember.exists) {
    // Document does not exists. We must create the member.
    await admin.firestore().collection(COL.MEMBER).doc(address).set(cOn({
      uid: address,
      nonce: generatedNonce
    }));

    // Load latest
    docMember = await admin.firestore().collection(COL.MEMBER).doc(address).get();
  }

  // Return member.
  return <Member>docMember.data();
});

export const updateMember: functions.CloudFunction<Member> = functions.runWith({
  minInstances: scale(WEN_FUNC.uMember),
}).https.onCall(async (req: WenRequest, context: any): Promise<Member> => {
  appCheck(WEN_FUNC.uMember, context);
  // Validate auth details before we continue
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
