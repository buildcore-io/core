import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { cid } from 'is-ipfs';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { DecodedToken } from '../../interfaces/functions/index';
import { COL, SPACE_COL } from '../../interfaces/models/base';
import { Member } from '../../interfaces/models/member';
import { cOn, serverTime } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { assertValidation } from "../utils/schema.utils";
import { decodeToken, ethAddressLength, getRandomEthAddress } from "../utils/wallet.utils";
import { WenError } from './../../interfaces/errors';

function defaultJoiUpdateCreateSchema(): any {
  return {
    name: Joi.string().required(),
    description: Joi.string().optional(),
    space: Joi.string().length(ethAddressLength).lowercase().required(),
    badge: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().optional(),
      ipfsCid: Joi.string().custom((value, helpers) => {
        if(cid(value)) {
          return true;
        } else {
          return helpers.error("Invalid IPFS CID");
        }
      }).required(),
      // Let's keep everything within 1Mi for now.
      count: Joi.number().min(0).max(1000).required(),
      // Let's CAP at 100 XP per badge for now.
      xp: Joi.number().min(0).max(1000).required()
    }).required()
  };
}

export const createAward: functions.CloudFunction<Member> = functions.https.onCall(async (token: string): Promise<Member> => {
  const params: DecodedToken = await decodeToken(token);
  const owner = params.address.toLowerCase();

  // We only get random address here that we use as ID.
  const awardAddress: string = getRandomEthAddress();

  const schema: ObjectSchema<Member> = Joi.object(defaultJoiUpdateCreateSchema());
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.space);
  if (!(await refSpace.get()).exists) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  const member = await admin.firestore().collection(COL.MEMBER).doc(owner).get();
  if (!member.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const refAward: any = admin.firestore().collection(COL.AWARD).doc(awardAddress);
  let docAward = await refAward.get();
  if (!docAward.exists) {
    // Document does not exists. We must create the member.
    await refAward.set(cOn(merge(params.body, {
      uid: awardAddress,
      createdBy: owner
    })));

    // Add Owner.
    await refAward.collection(SPACE_COL.OWNERS).doc(owner).set({
      uid: owner,
      createdOn: serverTime()
    });

    // Load latest
    docAward = await refAward.get();
  }


  // Return member.
  return <Member>docAward.data();
});
