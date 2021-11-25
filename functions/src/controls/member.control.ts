import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { WenError } from '../../interfaces/errors';
import { DecodedToken } from '../../interfaces/functions/index';
import { COL, WenRequest } from '../../interfaces/models/base';
import { cOn, uOn } from "../utils/dateTime.utils";
import { throwInvalidArgument, throwUnAuthenticated } from "../utils/error.utils";
import { assertValidation, getDefaultParams, pSchema } from "../utils/schema.utils";
import { cleanParams, decodeAuth, ethAddressLength } from "../utils/wallet.utils";
import { Member } from './../../interfaces/models/member';

function defaultJoiUpdateCreateSchema(): any {
  return merge(getDefaultParams(), {
    name: Joi.string().allow(null, '').optional(),
    about: Joi.string().allow(null, '').optional(),
    linkedin: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional(),
    github: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional(),
    twitter: Joi.string().allow(null, '').uri({
      scheme: ['https']
    }).optional()
  });
}

export const createMember: functions.CloudFunction<Member> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: 1,
}).https.onCall(async (address: string): Promise<Member> => {
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
  // Keep 1 instance so we never have cold start.
  minInstances: 1,
}).https.onCall(async (req: WenRequest): Promise<Member> => {
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

  if (params.body) {
    await admin.firestore().collection(COL.MEMBER).doc(address).update(uOn(pSchema(schema, cleanParams(params.body))));

    // Load latest
    docMember = await admin.firestore().collection(COL.MEMBER).doc(address).get();
  }

  // Return member.
  return <Member>docMember.data();
});
