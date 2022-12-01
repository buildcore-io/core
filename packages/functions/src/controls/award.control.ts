import {
  Award,
  AwardType,
  COL,
  DEFAULT_NETWORK,
  StandardResponse,
  SUB_COL,
  Transaction,
  TransactionType,
  URL_PATHS,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { cid } from 'is-ipfs';
import Joi, { ObjectSchema } from 'joi';
import { merge, round } from 'lodash';
import admin, { DocumentSnapshotType } from '../admin.config';
import { scale } from '../scale.settings';
import { cOn, dateToTimestamp, serverTime, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidationAsync, getDefaultParams } from '../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';
import { CommonJoi } from './../services/joi/common';
import { SpaceValidator } from './../services/validators/space';

function defaultJoiUpdateCreateSchema(): Award {
  return merge(getDefaultParams<Award>(), {
    name: Joi.string().required(),
    description: Joi.string().allow(null, '').optional(),
    type: Joi.number().equal(AwardType.PARTICIPATE_AND_APPROVE).required(),
    space: CommonJoi.uid(),
    endDate: Joi.date().required(),
    badge: Joi.object({
      name: Joi.string().required(),
      description: Joi.string().allow(null, '').optional(),
      // Let's keep everything within 10Mi for now.
      count: Joi.number().min(1).max(10000).required(),
      image: Joi.object({
        metadata: Joi.string()
          .custom((value) => {
            return cid(value);
          })
          .required(),
        fileName: Joi.string().required(),
        original: Joi.string()
          .custom((value) => {
            return cid(value);
          })
          .required(),
        avatar: Joi.string()
          .custom((value) => {
            return cid(value);
          })
          .required(),
      }).optional(),
      // Let's CAP at 100 XP per badge for now. XP must be dividable by count.
      xp: Joi.number().min(0).max(10000).required(),
    })
      .custom((obj, helper) => {
        // Validate value is dividable by count.
        if (obj.xp === 0 || obj.xp % obj.count == 0) {
          return obj;
        } else {
          return helper.error('Your total XP must be dividable without decimals');
        }
      })
      .required(),
  });
}

export const createAward: functions.CloudFunction<Award> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.cAward),
  })
  .https.onCall(
    async (req: WenRequest, context: functions.https.CallableContext): Promise<Award> => {
      appCheck(WEN_FUNC.cAward, context);
      const params = await decodeAuth(req, WEN_FUNC.cAward);
      const owner = params.address.toLowerCase();

      // We only get random address here that we use as ID.
      const awardAddress: string = getRandomEthAddress();

      const schema: ObjectSchema<Award> = Joi.object(defaultJoiUpdateCreateSchema());
      await assertValidationAsync(schema, params.body);

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(params.body.space);
      await SpaceValidator.spaceExists(refSpace);

      const member = await admin.firestore().collection(COL.MEMBER).doc(owner).get();
      if (!member.exists) {
        throw throwInvalidArgument(WenError.member_does_not_exists);
      }

      if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(owner).get()).exists) {
        throw throwInvalidArgument(WenError.you_are_not_part_of_space);
      }

      // Get available badge.
      if (params.body?.badge?.image) {
        const doc = await admin
          .firestore()
          .collection(COL.BADGES)
          .doc(params.body?.badge.image.metadata)
          .get();
        if (!doc.exists) {
          throw throwInvalidArgument(WenError.ntt_does_not_exists);
        }

        if (doc.data()?.available !== true) {
          throw throwInvalidArgument(WenError.ntt_is_no_longer_available);
        }
      }

      const refAward: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.AWARD)
        .doc(awardAddress);
      let docAward = await refAward.get();
      if (!docAward.exists) {
        // Document does not exists.
        await refAward.set(
          cOn(
            merge(params.body, {
              uid: awardAddress,
              issued: 0,
              rank: 1,
              completed: false,
              endDate: dateToTimestamp(params.body.endDate, true),
              createdBy: owner,
              approved: false,
              rejected: false,
            }),
            URL_PATHS.AWARD,
          ),
        );

        // Add Owner.
        await refAward
          .collection(SUB_COL.OWNERS)
          .doc(owner)
          .set(
            cOn({
              uid: owner,
              parentId: awardAddress,
              parentCol: COL.AWARD,
            }),
          );

        if (params.body?.badge?.image) {
          await admin
            .firestore()
            .collection(COL.BADGES)
            .doc(params.body?.badge.image.metadata)
            .update(
              uOn({
                available: false,
              }),
            );
        }

        // Load latest.
        docAward = await refAward.get();
      }

      // Return member.
      return <Award>docAward.data();
    },
  );

export const addOwner: functions.CloudFunction<Award> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.addOwnerAward),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.addOwnerAward, context);
      // Validate auth details before we continue
      const params = await decodeAuth(req, WEN_FUNC.addOwnerAward);
      const owner = params.address.toLowerCase();

      const schema: ObjectSchema<Award> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uid(),
          member: CommonJoi.uid(),
        }),
      );
      await assertValidationAsync(schema, params.body);

      const refAward: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.AWARD)
        .doc(params.body.uid);
      let docAward!: DocumentSnapshotType;
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
        await refAward
          .collection(SUB_COL.OWNERS)
          .doc(params.body.member)
          .set(
            cOn({
              uid: params.body.member,
              parentId: params.body.uid,
              parentCol: COL.AWARD,
            }),
          );

        // Load latest
        docAward = await refAward.collection(SUB_COL.OWNERS).doc(params.body.member).get();
      }

      return docAward.data();
    },
  );

export const approveAward: functions.CloudFunction<Award> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.aAward),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.aAward, context);
      // Validate auth details before we continue
      const params = await decodeAuth(req, WEN_FUNC.aAward);
      const owner = params.address.toLowerCase();
      const schema: ObjectSchema<Award> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uid(),
        }),
      );
      await assertValidationAsync(schema, params.body);

      const refAward: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.AWARD)
        .doc(params.body.uid);
      const docAward: DocumentSnapshotType = await refAward.get();
      let docTran!: DocumentSnapshotType;
      if (!docAward.exists) {
        throw throwInvalidArgument(WenError.award_does_not_exists);
      }

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(docAward.data().space);
      if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).get()).exists) {
        throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
      }

      if (docAward.data().approved) {
        throw throwInvalidArgument(WenError.proposal_is_already_approved);
      }

      if (params.body) {
        await refAward.update(
          uOn({
            approved: true,
            approvedBy: owner,
          }),
        );

        // Load latest
        docTran = await refAward.get();
      }

      return docTran.data();
    },
  );

export const rejectAward: functions.CloudFunction<Award> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.rAward),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.rAward, context);
      // Validate auth details before we continue
      const params = await decodeAuth(req, WEN_FUNC.rAward);
      const owner = params.address.toLowerCase();
      const schema: ObjectSchema<Award> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uid(),
        }),
      );
      await assertValidationAsync(schema, params.body);

      const refAward: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.AWARD)
        .doc(params.body.uid);
      const docAward: DocumentSnapshotType = await refAward.get();
      let docTran!: DocumentSnapshotType;
      if (!docAward.exists) {
        throw throwInvalidArgument(WenError.proposal_does_not_exists);
      }

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(docAward.data().space);
      if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).get()).exists) {
        throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
      }

      if (docAward.data().approved) {
        throw throwInvalidArgument(WenError.award_is_already_approved);
      }

      if (docAward.data().rejected) {
        throw throwInvalidArgument(WenError.award_is_already_rejected);
      }

      if (params.body) {
        await refAward.update(
          uOn({
            rejected: true,
            rejectedBy: owner,
          }),
        );

        // Load latest
        docTran = await refAward.get();
      }

      return docTran.data();
    },
  );

export const participate: functions.CloudFunction<Award> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.participateAward),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.participateAward, context);
      // Validate auth details before we continue
      const params = await decodeAuth(req, WEN_FUNC.participateAward);
      const participant = params.address.toLowerCase();

      const schema: ObjectSchema<Award> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uid(),
          comment: Joi.string().allow(null, '').optional(),
        }),
      );
      await assertValidationAsync(schema, params.body);

      const refAward: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.AWARD)
        .doc(params.body.uid);
      const docAward: DocumentSnapshotType = await refAward.get();
      if (!docAward.exists) {
        throw throwInvalidArgument(WenError.award_does_not_exists);
      }

      if (dayjs(docAward.data().endDate).isBefore(dayjs())) {
        throw throwInvalidArgument(WenError.award_is_no_longer_available);
      }

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(docAward.data().space);
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

      if (docAward.data().rejected) {
        throw throwInvalidArgument(WenError.award_is_rejected);
      }

      if (!docAward.data().approved) {
        throw throwInvalidArgument(WenError.award_is_not_approved);
      }

      let output!: DocumentSnapshotType;
      if (params.body) {
        await refAward
          .collection(SUB_COL.PARTICIPANTS)
          .doc(participant)
          .set(
            cOn({
              uid: participant,
              comment: params.body.comment || null,
              parentId: params.body.uid,
              completed: false,
              parentCol: COL.AWARD,
            }),
          );

        // Load latest
        output = await refAward.collection(SUB_COL.PARTICIPANTS).doc(participant).get();
      }

      return output.data();
    },
  );

export const approveParticipant: functions.CloudFunction<Award> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.aParticipantAward),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.aParticipantAward, context);
      // Validate auth details before we continue
      const params = await decodeAuth(req, WEN_FUNC.aParticipantAward);
      // TODO Fix for below validation.
      const owner = params.address.toLowerCase();
      const tranId = getRandomEthAddress();
      const schema: ObjectSchema<Award> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uid(),
          member: CommonJoi.uid(),
        }),
      );
      await assertValidationAsync(schema, params.body);

      const refAward: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.AWARD)
        .doc(params.body.uid);
      const docAward: DocumentSnapshotType = await refAward.get();
      let docTran!: DocumentSnapshotType;
      if (!docAward.exists) {
        throw throwInvalidArgument(WenError.award_does_not_exists);
      }

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(docAward.data().space);
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

      const participant: admin.firestore.DocumentReference = refAward
        .collection(SUB_COL.PARTICIPANTS)
        .doc(params.body.member);
      const participantRec: DocumentSnapshotType = await participant.get();
      if (params.body) {
        // Member might not be participant of the space, that's fine. we just need to add him.
        if (!participantRec.exists) {
          await participant.set(
            cOn({
              uid: params.body.member,
              parentId: params.body.uid,
              parentCol: COL.AWARD,
            }),
          );
        }

        // Increase count via transaction.
        await admin.firestore().runTransaction(async (transaction) => {
          const sfDoc: DocumentSnapshotType = await transaction.get(refAward);
          const newCount = (sfDoc.data().issued || 0) + 1;
          transaction.update(
            refAward,
            uOn({
              issued: newCount,
              completed: newCount >= sfDoc.data().badge.count,
            }),
          );
        });

        // Issue badge transaction.
        const refTran: admin.firestore.DocumentReference = admin
          .firestore()
          .collection(COL.TRANSACTION)
          .doc(tranId);
        const xp: number = round(docAward.data().badge.xp / docAward.data().badge.count);

        // Mark participant that he completed.
        await participant.update(
          uOn({
            completed: true,
            count: participantRec.exists ? (participantRec.data().count || 0) + 1 : 1,
            xp: xp,
          }),
        );

        await refTran.set(
          cOn(<Transaction>{
            type: TransactionType.BADGE,
            uid: tranId,
            member: params.body.member,
            space: docAward.data().space,
            network: DEFAULT_NETWORK,
            payload: {
              award: params.body.uid,
              name: docAward.data().name,
              image: docAward.data().badge.image || null,
              description: docAward.data().description,
              xp: xp,
            },
          }),
        );

        // We've to update the members stats.
        // - We need to track it per space as well.
        // - We need to track on space who they have alliance with and use that to determine which XP/awards to pick
        const refMember: admin.firestore.DocumentReference = admin
          .firestore()
          .collection(COL.MEMBER)
          .doc(params.body.member);
        await admin.firestore().runTransaction(async (transaction) => {
          const sfDoc: DocumentSnapshotType = await transaction.get(refMember);
          const awardsCompleted = (sfDoc.data().awardsCompleted || 0) + 1;
          const totalReputation = (sfDoc.data().totalReputation || 0) + xp;
          const finalObj = {
            ...sfDoc.data(),
            ...{
              awardsCompleted: awardsCompleted,
              totalReputation: totalReputation,
            },
          };

          // Calculate for space.
          finalObj.spaces = finalObj.spaces || {};
          finalObj.spaces[docAward.data().space] = finalObj.spaces[docAward.data().space] || {
            uid: docAward.data().space,
            createdOn: serverTime(),
          };
          finalObj.spaces[docAward.data().space].badges =
            finalObj.spaces[docAward.data().space].badges || [];
          finalObj.spaces[docAward.data().space].badges.push(tranId);
          finalObj.spaces[docAward.data().space].awardsCompleted =
            (finalObj.spaces[docAward.data().space].awardsCompleted || 0) + 1;
          finalObj.spaces[docAward.data().space].totalReputation =
            (finalObj.spaces[docAward.data().space].totalReputation || 0) + xp;
          finalObj.spaces[docAward.data().space].updatedOn = serverTime();
          transaction.update(refMember, uOn(finalObj));
        });

        // Load latest
        docTran = await refTran.get();
      }

      return docTran.data();
    },
  );
