import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { DecodedToken } from '../../interfaces/functions/index';
import { COL } from '../../interfaces/models/base';
import { Member } from '../../interfaces/models/member';
import { throwInvalidArgument } from "../utils/error.utils";
import { assertValidation } from "../utils/schema.utils";
import { decodeToken } from "../utils/wallet.utils";
import { WenError } from './../../interfaces/errors';

function defaultJoiUpdateCreateSchema(): any {
  return {
    name: Joi.string().required(),
    description: Joi.string().optional(),
    badge: Joi.object({
      name: Joi.string().required(),
      // TODO Validate IPFS location
      uri: Joi.string().uri().required(),
      count: Joi.number().required(),
      // Let's CAP at 100 XP per badge for now.
      xp: Joi.number().min(0).max(100).optional()
    }).required()
  };
}

export const createAward: functions.CloudFunction<Member> = functions.https.onCall(async (token: string): Promise<Member> => {
  const params: DecodedToken = await decodeToken(token);
  const address = params.address.toLowerCase();

  const schema: ObjectSchema<Member> = Joi.object(defaultJoiUpdateCreateSchema());
  assertValidation(schema.validate(params.body));

  const member = await admin.firestore().collection(COL.MEMBER).doc(address).get();
  if (!member.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  // Return member.
  return <Member>member.data();
});
