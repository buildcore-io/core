import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { WenError } from '../../interfaces/errors';
import { DecodedToken, WEN_FUNC } from '../../interfaces/functions/index';
import { COL, WenRequest } from '../../interfaces/models/base';
import { scale } from "../scale.settings";
import { cOn, uOn } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { appCheck } from "../utils/google.utils";
import { keywords } from "../utils/keywords.utils";
import { assertValidation, getDefaultParams, pSchema } from "../utils/schema.utils";
import { cleanParams, decodeAuth, getRandomEthAddress } from "../utils/wallet.utils";
import { DISCORD_REGEXP, TWITTER_REGEXP } from './../../interfaces/config';
import { Collection } from './../../interfaces/models/collection';
import { Member } from './../../interfaces/models/member';
import { CommonJoi } from './../services/joi/common';
import { SpaceValidator } from './../services/validators/space';

function defaultJoiUpdateCreateSchema(): any {
  return merge(getDefaultParams(), {
    name: Joi.string().allow(null, '').required(),
    description: Joi.string().allow(null, '').required(),
    space: CommonJoi.uidCheck(),
    bannerUrl: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional(),
    royaltiesFee: Joi.number().min(0.01).max(1).required(),
    royaltiesSpace: CommonJoi.uidCheck(),
    // TODO Validate XP is not the same.
    discounts: Joi.array().items(Joi.object().keys({
      xp: Joi.string().required(),
      amount: Joi.number().min(0.01).max(1).required()
    })).min(1).max(5).optional(),
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
  const creator = params.address.toLowerCase();
  const collectionAddress: string = getRandomEthAddress();
  const schema: ObjectSchema<Member> = Joi.object(defaultJoiUpdateCreateSchema());
  assertValidation(schema.validate(params.body));

  const docMember: any = await admin.firestore().collection(COL.MEMBER).doc(creator).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  // Validate space exists.
  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.space);
  await SpaceValidator.spaceExists(refSpace);

  const refCollection: any = admin.firestore().collection(COL.COLLECTION).doc(collectionAddress);
  let docCollection: any = await refCollection.get();
  if (!docCollection.exists) {
    // Document does not exists.
    await refCollection.set(keywords(cOn(merge(cleanParams(params.body), {
      uid: collectionAddress,
      total: 0,
      sold: 0,
      createdBy: creator,
      approved: false,
      rejected: false
    }))));

    // Load latest
    docCollection = await refCollection.get();
  }

  // Return member.
  return <Member>docCollection.data();
});

export const updateCollection: functions.CloudFunction<Member> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: scale(WEN_FUNC.uCollection),
}).https.onCall(async (req: WenRequest, context: any): Promise<Member> => {
  appCheck(WEN_FUNC.cCollection, context);
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const member = params.address.toLowerCase();
  const schema: ObjectSchema<Collection> = Joi.object(merge(defaultJoiUpdateCreateSchema(), {
    uid: CommonJoi.uidCheck()
  }));
  assertValidation(schema.validate(params.body));

  const docMember: any = await admin.firestore().collection(COL.MEMBER).doc(member).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  // Validate space exists.
  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.space);
  await SpaceValidator.spaceExists(refSpace);
  await SpaceValidator.isGuardian(refSpace, member);

  const refCollection: any = admin.firestore().collection(COL.COLLECTION).doc(params.body.uid);
  let docCollection: any = await refCollection.get();
  if (!docCollection.exists) {
    throw throwInvalidArgument(WenError.collection_does_not_exists);
  }

  // Document does not exists.
  await admin.firestore().collection(COL.COLLECTION).doc(params.body.uid).update(keywords(uOn(pSchema(schema, params.body))));


  // Load latest
  docCollection = await refCollection.get();
  // Return member.
  return <Member>docCollection.data();
});
