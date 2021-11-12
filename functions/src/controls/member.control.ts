import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { WenError } from '../../interfaces/errors';
import { DecodedToken } from '../../interfaces/functions/index';
import { COL } from '../../interfaces/models/base';
import { cOn, uOn } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { assertValidation, pSchema } from "../utils/schema.utils";
import { decodeToken } from "../utils/wallet.utils";
import { Member } from './../../interfaces/models/member';

function defaultJoiUpdateCreateSchema(): any {
  return {
    name: Joi.string().optional(),
    linkedIn: Joi.string().uri({
      scheme: ['https']
    }).optional(),
    facebook: Joi.string().uri({
      scheme: ['https']
    }).optional(),
    twitter: Joi.string().uri({
      scheme: ['https']
    }).optional()
  };
}

export const createMember: functions.CloudFunction<Member> = functions.https.onCall(async (token: string): Promise<Member> => {
  const params: DecodedToken = await decodeToken(token);
  const address = params.address.toLowerCase();

  // Body might be provided.
  if (params.body && Object.keys(params.body).length > 0) {
    const schema: ObjectSchema<Member> = Joi.object(defaultJoiUpdateCreateSchema());
    assertValidation(schema.validate(params.body));
  }

  let docMember = await admin.firestore().collection(COL.MEMBER).doc(address).get();
  if (!docMember.exists) {
    // Document does not exists. We must create the member.
    await admin.firestore().collection(COL.MEMBER).doc(address).set(cOn(merge(params.body, {
      uid: address
    })));

    // Load latest
    docMember = await admin.firestore().collection(COL.MEMBER).doc(address).get();
  }

  // Return member.
  return <Member>docMember.data();
});

export const updateMember: functions.CloudFunction<Member> = functions.https.onCall(async (token: string): Promise<Member> => {
  // We must part
  const params: DecodedToken = await decodeToken(token);
  const address = params.address.toLowerCase();
  const schema: ObjectSchema<Member> = Joi.object(merge(defaultJoiUpdateCreateSchema(), {
    uid: Joi.string().equal(address).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  let docMember = await admin.firestore().collection(COL.MEMBER).doc(address).get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  if (params.body) {
    await admin.firestore().collection(COL.MEMBER).doc(address).update(uOn(pSchema(schema, params.body)));

    // Load latest
    docMember = await admin.firestore().collection(COL.MEMBER).doc(address).get();
  }

  // Return member.
  return <Member>docMember.data();
});
