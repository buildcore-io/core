import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { cid } from 'is-ipfs';
import Joi, { ObjectSchema } from "joi";
import { merge, round } from 'lodash';
import { DecodedToken } from '../../interfaces/functions/index';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { cOn, serverTime } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { assertValidation, getDefaultParams } from "../utils/schema.utils";
import { cleanParams, decodeAuth, ethAddressLength, getRandomEthAddress } from "../utils/wallet.utils";
import { WenError } from './../../interfaces/errors';
import { StandardResponse } from './../../interfaces/functions/index';
import { Award } from './../../interfaces/models/award';
import { WenRequest } from './../../interfaces/models/base';
import { Transaction, TransactionType } from './../../interfaces/models/transaction';

function defaultJoiUpdateCreateSchema(): any {
  return merge(getDefaultParams(), {
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
      // Let's CAP at 100 XP per badge for now. XP must be dividable by count.
      xp: Joi.number().min(0).max(1000).custom((value) => {
        // Validate value is dividable by count.
        if (value === 0 || (value % <any>Joi.ref('count')) == 0) {
          return true;
        } else {
          return true;
        }
      }).required()
    }).required()
  });
}

export const createAward: functions.CloudFunction<Award> = functions.https.onCall(async (req: WenRequest): Promise<Award> => {
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  // We only get random address here that we use as ID.
  const awardAddress: string = getRandomEthAddress();

  const schema: ObjectSchema<Award> = Joi.object(defaultJoiUpdateCreateSchema());
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
    // Document does not exists.
    await refAward.set(cOn(merge(cleanParams(params.body), {
      uid: awardAddress,
      issued: 0,
      createdBy: owner
    })));

    // Add Owner.
    await refAward.collection(SUB_COL.OWNERS).doc(owner).set({
      uid: owner,
      createdOn: serverTime()
    });

    // Load latest
    docAward = await refAward.get();
  }


  // Return member.
  return <Award>docAward.data();
});

export const addOwner: functions.CloudFunction<Award> = functions.https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  const schema: ObjectSchema<Award> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      member: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refAward: any = admin.firestore().collection(COL.AWARD).doc(params.body.uid);
  let docAward: any;
  if (!(await refAward.get()).exists) {
    throw throwInvalidArgument(WenError.award_does_not_exists);
  }

  if (!(await refAward.collection(SUB_COL.OWNERS).doc(owner).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_owner_of_the_award);
  }

  if ((await refAward.collection(SUB_COL.OWNERS).doc(params.body.member).get()).exists) {
    throw throwInvalidArgument(WenError.member_is_already_owner_of_space);
  }

  if (params.body) {
    await refAward.collection(SUB_COL.OWNERS).doc(params.body.member).set({
      uid: params.body.member,
      createdOn: serverTime()
    });

    // Load latest
    docAward = await refAward.collection(SUB_COL.OWNERS).doc(params.body.member).get();
  }

  return docAward.data();
});

export const participate: functions.CloudFunction<Award> = functions.https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const participant = params.address.toLowerCase();

  const schema: ObjectSchema<Award> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refAward: any = admin.firestore().collection(COL.AWARD).doc(params.body.uid);
  let docAward: any;
  if (!(await refAward.get()).exists) {
    throw throwInvalidArgument(WenError.award_does_not_exists);
  }

  const member = await admin.firestore().collection(COL.MEMBER).doc(participant).get();
  if (!member.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  if ((await refAward.collection(SUB_COL.PARTICIPANTS).doc(participant).get()).exists) {
    throw throwInvalidArgument(WenError.member_is_already_participant_of_space);
  }

  if (params.body) {
    await refAward.collection(SUB_COL.PARTICIPANTS).doc(participant).set({
      uid: participant,
      createdOn: serverTime()
    });

    // Load latest
    docAward = await refAward.collection(SUB_COL.PARTICIPANTS).doc(participant).get();
  }

  return docAward.data();
});

export const approveParticipant: functions.CloudFunction<Award> = functions.https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const tranId = getRandomEthAddress();
  const schema: ObjectSchema<Award> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      member: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refAward: any = admin.firestore().collection(COL.AWARD).doc(params.body.uid);
  const docAward: any = await refAward.get();
  let docTran: any;
  if (!docAward.exists) {
    throw throwInvalidArgument(WenError.award_does_not_exists);
  }

  if (!(await refAward.collection(SUB_COL.OWNERS).doc(owner).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_owner_of_the_award);
  }

  // We reached limit of issued awards.
  if (docAward.data().issued >= docAward.data().badge.count) {
    throw throwInvalidArgument(WenError.no_more_available_badges);
  }

  const member = await admin.firestore().collection(COL.MEMBER).doc(params.body.member).get();
  if (!member.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  if (params.body) {
    // Member might not be participant of the space, that's fine. we just need to add him.
    if (!(await refAward.collection(SUB_COL.PARTICIPANTS).doc(params.body.member).get()).exists) {
      await refAward.collection(SUB_COL.PARTICIPANTS).doc(params.body.member).set({
        uid: params.body.member,
        createdOn: serverTime()
      });
    }

    // Increase count via transaction.
    await admin.firestore().runTransaction(async (transaction) => {
      const sfDoc: any = await transaction.get(refAward);
      const newCount = (sfDoc.data().issued || 0) + 1;
      transaction.update(refAward, {
        issued: newCount
      });
    });

    // Issue badge transaction.
    const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
    const xp: number = round(docAward.data().badge.xp / docAward.data().badge.count);
    await refTran.set(<Transaction>{
      type: TransactionType.BADGE,
      uid: getRandomEthAddress(),
      member: params.body.member,
      createdOn: serverTime(),
      payload: {
        awardId: params.body.uid,
        xp: xp
      }
    });

    // We've to update the members stats.
    const refMember: any = admin.firestore().collection(COL.MEMBER).doc(params.body.member);
    await admin.firestore().runTransaction(async (transaction) => {
      const sfDoc: any = await transaction.get(refMember);
      const awardsCompleted = (sfDoc.data().awardsCompleted || 0) + 1;
      const totalReputation = (sfDoc.data().totalReputation || 0) + xp;
      transaction.update(refAward, {
        awardsCompleted: awardsCompleted,
        totalReputation: totalReputation
      });
    });


    // Load latest
    docTran = await refTran.get();
  }

  return docTran.data();
});

