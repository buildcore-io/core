import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import { cid } from 'is-ipfs';
import Joi, { ObjectSchema } from 'joi';
import { merge, round } from 'lodash';
import { WEN_FUNC } from '../../interfaces/functions';
import { DecodedToken } from '../../interfaces/functions/index';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { scale } from "../scale.settings";
import { cOn, dateToTimestamp, serverTime } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { appCheck } from "../utils/google.utils";
import { keywords } from "../utils/keywords.utils";
import { assertValidation, getDefaultParams } from "../utils/schema.utils";
import { cleanParams, decodeAuth, ethAddressLength, getRandomEthAddress } from "../utils/wallet.utils";
import { WenError } from './../../interfaces/errors';
import { StandardResponse } from './../../interfaces/functions/index';
import { Award, AwardType } from './../../interfaces/models/award';
import { WenRequest } from './../../interfaces/models/base';
import { Transaction, TransactionType } from './../../interfaces/models/transaction';

function defaultJoiUpdateCreateSchema(): any {
  return merge(getDefaultParams(), {
    name: Joi.string().required(),
    description: Joi.string().allow(null, '').optional(),
    type: Joi.number().equal(AwardType.PARTICIPATE_AND_APPROVE).required(),
    space: Joi.string().length(ethAddressLength).lowercase().required(),
    endDate: Joi.date().required(),
    badge: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().allow(null, '').optional(),
      // Let's keep everything within 1Mi for now.
      count: Joi.number().min(1).max(1000).required(),
      image: Joi.object({
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
      // Let's CAP at 100 XP per badge for now. XP must be dividable by count.
      xp: Joi.number().min(0).max(1000).custom((value) => {
        // Validate value is dividable by count.
        if (value === 0 || (value % <any>Joi.ref('count')) == 0) {
          return true;
        } else {
          return false;
        }
      }).required()
    }).required()
  });
}

export const createAward: functions.CloudFunction<Award> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: scale(WEN_FUNC.cAward),
}).https.onCall(async (req: WenRequest, context: any): Promise<Award> => {
  appCheck(WEN_FUNC.cAward, context);
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

  if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(owner).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_part_of_space);
  }

  // Get available badge.
  if (params.body?.badge?.image) {
    const doc = await admin.firestore().collection(COL.BADGES).doc(params.body?.badge.image.metadata).get();
    if (!doc.exists) {
      throw throwInvalidArgument(WenError.ntt_does_not_exists);
    }

    if (doc.data()!.available !== true) {
      throw throwInvalidArgument(WenError.ntt_is_no_longer_available);
    }
  }

  const refAward: any = admin.firestore().collection(COL.AWARD).doc(awardAddress);
  let docAward = await refAward.get();
  if (!docAward.exists) {
    // Document does not exists.
    await refAward.set(keywords(cOn(merge(cleanParams(params.body), {
      uid: awardAddress,
      issued: 0,
      rank: 1,
      completed: false,
      endDate: dateToTimestamp(params.body.endDate),
      createdBy: owner
    }))));

    // Add Owner.
    await refAward.collection(SUB_COL.OWNERS).doc(owner).set({
      uid: owner,
      parentId: awardAddress,
      parentCol: COL.AWARD,
      createdOn: serverTime()
    });

    if (params.body?.badge?.image) {
      await admin.firestore().collection(COL.BADGES).doc(params.body?.badge.image.metadata).update({
        available: false
      });
    }

    // Load latest.
    docAward = await refAward.get();
  }


  // Return member.
  return <Award>docAward.data();
});

export const addOwner: functions.CloudFunction<Award> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: scale(WEN_FUNC.addOwnerAward),
}).https.onCall(async (req: WenRequest, context: any): Promise<StandardResponse> => {
  appCheck(WEN_FUNC.addOwnerAward, context);
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
      parentId: params.body.uid,
      parentCol: COL.AWARD,
      createdOn: serverTime()
    });

    // Load latest
    docAward = await refAward.collection(SUB_COL.OWNERS).doc(params.body.member).get();
  }

  return docAward.data();
});

export const participate: functions.CloudFunction<Award> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: scale(WEN_FUNC.participateAward),
}).https.onCall(async (req: WenRequest, context: any): Promise<StandardResponse> => {
  appCheck(WEN_FUNC.participateAward, context);
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const participant = params.address.toLowerCase();

  const schema: ObjectSchema<Award> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      comment: Joi.string().allow(null, '').optional()
  }));
  assertValidation(schema.validate(params.body));

  const refAward: any = admin.firestore().collection(COL.AWARD).doc(params.body.uid);
  const docAward: any = (await refAward.get());
  if (!docAward.exists) {
    throw throwInvalidArgument(WenError.award_does_not_exists);
  }

  if (dayjs(docAward.data().endDate).isBefore(dayjs())) {
    throw throwInvalidArgument(WenError.award_is_no_longer_available);
  }

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(docAward.data().space);
  if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(participant).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_part_of_space);
  }

  const member = await admin.firestore().collection(COL.MEMBER).doc(participant).get();
  if (!member.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  if ((await refAward.collection(SUB_COL.PARTICIPANTS).doc(participant).get()).exists) {
    throw throwInvalidArgument(WenError.member_is_already_participant_of_space);
  }

  let output: any;
  if (params.body) {
    await refAward.collection(SUB_COL.PARTICIPANTS).doc(participant).set({
      uid: participant,
      comment: params.body.comment || null,
      parentId: params.body.uid,
      completed: false,
      parentCol: COL.AWARD,
      createdOn: serverTime()
    });

    // Load latest
    output = await refAward.collection(SUB_COL.PARTICIPANTS).doc(participant).get();
  }

  return output.data();
});

export const approveParticipant: functions.CloudFunction<Award> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: scale(WEN_FUNC.aAward),
}).https.onCall(async (req: WenRequest, context: any): Promise<StandardResponse> => {
  appCheck(WEN_FUNC.aAward, context);
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  // TODO Fix for below validation.
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

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(docAward.data().space);
  if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }

  // We reached limit of issued awards.
  if (docAward.data().issued >= docAward.data().badge.count) {
    throw throwInvalidArgument(WenError.no_more_available_badges);
  }

  const member = await admin.firestore().collection(COL.MEMBER).doc(params.body.member).get();
  if (!member.exists) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const participant: any = await refAward.collection(SUB_COL.PARTICIPANTS).doc(params.body.member);
  const participantRec: any = participant.get();
  if (params.body) {
    // Member might not be participant of the space, that's fine. we just need to add him.
    if (!participantRec.exists) {
      await participant.set({
        uid: params.body.member,
        parentId: params.body.uid,
        parentCol: COL.AWARD,
        createdOn: serverTime()
      });
    }

    // Increase count via transaction.
    await admin.firestore().runTransaction(async (transaction) => {
      const sfDoc: any = await transaction.get(refAward);
      const newCount = (sfDoc.data().issued || 0) + 1;
      transaction.update(refAward, {
        issued: newCount,
        completed: (newCount >= sfDoc.data().badge.count)
      });
    });

    // Issue badge transaction.
    const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
    const xp: number = round(docAward.data().badge.xp / docAward.data().badge.count);

    // Mark participant that he completed.
    await participant.update({
      completed: true,
      count: participantRec.exists ? (participantRec.data().count || 0) + 1 : 1,
      xp: xp
    });

    await refTran.set(<Transaction>{
      type: TransactionType.BADGE,
      uid: getRandomEthAddress(),
      member: params.body.member,
      space: docAward.data().space,
      createdOn: serverTime(),
      payload: {
        award: params.body.uid,
        name: docAward.data().name,
        image: docAward.data().badge.image || null,
        description: docAward.data().description,
        xp: xp
      }
    });

    // We've to update the members stats.
    const refMember: any = admin.firestore().collection(COL.MEMBER).doc(params.body.member);
    await admin.firestore().runTransaction(async (transaction) => {
      const sfDoc: any = await transaction.get(refMember);
      const awardsCompleted = (sfDoc.data().awardsCompleted || 0) + 1;
      const totalReputation = (sfDoc.data().totalReputation || 0) + xp;
      transaction.update(refMember, {
        awardsCompleted: awardsCompleted,
        totalReputation: totalReputation
      });
    });


    // Load latest
    docTran = await refTran.get();
  }

  return docTran.data();
});

