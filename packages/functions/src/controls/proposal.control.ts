import {
  COL,
  DEFAULT_NETWORK,
  Proposal,
  ProposalAnswer,
  ProposalMember,
  ProposalQuestion,
  ProposalStartDateMin,
  ProposalSubType,
  ProposalType,
  RelatedRecordsResponse,
  StandardResponse,
  SUB_COL,
  Transaction,
  TransactionType,
  URL_PATHS,
  VoteTransaction,
  WenError,
  WenRequest,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from 'joi';
import { merge } from 'lodash';
import admin, { DocumentSnapshotType } from '../admin.config';
import { scale } from '../scale.settings';
import { cOn, dateToTimestamp, uOn } from '../utils/dateTime.utils';
import { throwInvalidArgument } from '../utils/error.utils';
import { appCheck } from '../utils/google.utils';
import { assertValidationAsync, getDefaultParams } from '../utils/schema.utils';
import { decodeAuth, getRandomEthAddress } from '../utils/wallet.utils';
import { CommonJoi } from './../services/joi/common';
import { SpaceValidator } from './../services/validators/space';

function defaultJoiUpdateCreateSchema(): Proposal {
  return merge(getDefaultParams<Proposal>(), {
    name: Joi.string().required(),
    space: CommonJoi.uid(),
    additionalInfo: Joi.string().allow(null, '').optional(),
    type: Joi.number().equal(ProposalType.MEMBERS, ProposalType.NATIVE).required(),
    subType: Joi.when('type', {
      is: Joi.exist().valid(ProposalType.NATIVE),
      then: Joi.number().equal(ProposalSubType.ONE_ADDRESS_ONE_VOTE).required(),
      otherwise: Joi.number()
        .equal(
          ProposalSubType.ONE_MEMBER_ONE_VOTE,
          ProposalSubType.REPUTATION_BASED_ON_AWARDS,
          ProposalSubType.REPUTATION_BASED_ON_SPACE,
          ProposalSubType.REPUTATION_BASED_ON_SPACE_WITH_ALLIANCE,
        )
        .required(),
    }),
    settings: Joi.when('type', {
      is: Joi.exist().valid(ProposalType.NATIVE),
      then: Joi.object({
        milestoneIndexCommence: Joi.number().required(),
        milestoneIndexStart: Joi.number().greater(Joi.ref('milestoneIndexCommence')).required(),
        milestoneIndexEnd: Joi.number().greater(Joi.ref('milestoneIndexStart')).required(),
      }).required(),
      otherwise: Joi.object({
        // Must be one day in the future.
        startDate: Joi.date()
          .greater(Date.now() + ProposalStartDateMin.value)
          .required(),
        endDate: Joi.date().greater(Joi.ref('startDate')).required(),
        onlyGuardians: Joi.boolean().required(),
        awards: Joi.when('subType', {
          is: Joi.exist().valid(ProposalSubType.REPUTATION_BASED_ON_AWARDS),
          then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
        }),
        defaultMinWeight: Joi.when('subType', {
          is: Joi.exist().valid(
            ProposalSubType.REPUTATION_BASED_ON_SPACE,
            ProposalSubType.REPUTATION_BASED_ON_SPACE_WITH_ALLIANCE,
            ProposalSubType.REPUTATION_BASED_ON_AWARDS,
          ),
          then: Joi.number().optional(),
        }),
      }).required(),
    }),
    questions: Joi.array()
      .items(
        Joi.object().keys({
          text: Joi.string().required(),
          additionalInfo: Joi.string().allow(null, '').optional(),
          answers: Joi.array()
            .items(
              Joi.object().keys({
                value: Joi.number().required(),
                text: Joi.string().required(),
                additionalInfo: Joi.string().allow(null, '').optional(),
              }),
            )
            .min(2)
            .required(),
          // To enable more questions, fix front-end. Also tweak voteOnProposal to validate.
        }),
      )
      .min(1)
      .max(1)
      .required(),
  });
}

export const createProposal: functions.CloudFunction<Proposal> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.cProposal),
    timeoutSeconds: 300,
    memory: '2GB',
  })
  .https.onCall(
    async (req: WenRequest, context: functions.https.CallableContext): Promise<Proposal> => {
      appCheck(WEN_FUNC.cProposal, context);
      const params = await decodeAuth(req, WEN_FUNC.cProposal);
      const owner = params.address.toLowerCase();

      // We only get random address here that we use as ID.
      const proposalAddress: string = getRandomEthAddress();

      const schema: ObjectSchema<Proposal> = Joi.object(defaultJoiUpdateCreateSchema());
      await assertValidationAsync(schema, params.body);

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(params.body.space);
      await SpaceValidator.spaceExists(refSpace);

      const docSpace: DocumentSnapshotType = await refSpace.get();
      if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(owner).get()).exists) {
        throw throwInvalidArgument(WenError.you_are_not_part_of_space);
      }

      if (params.body.settings?.startDate) {
        params.body.settings.startDate = dateToTimestamp(params.body.settings.startDate, true);
      }

      if (params.body.settings?.endDate) {
        params.body.settings.endDate = dateToTimestamp(params.body.settings.endDate, true);
      }

      const refProposal: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.PROPOSAL)
        .doc(proposalAddress);
      let docProposal = await refProposal.get();
      if (!docProposal.exists) {
        // Document does not exists.
        await refProposal.set(
          cOn(
            merge(params.body, {
              uid: proposalAddress,
              rank: 1,
              createdBy: owner,
              approved: false,
              rejected: false,
            }),
            URL_PATHS.PROPOSAL,
          ),
        );

        // This can't be empty.
        // Add Owners based on space's guardians or members.
        let totalWeight = 0;
        if (params.body.type === ProposalType.MEMBERS) {
          let query: admin.firestore.QuerySnapshot;
          if (params.body.settings.onlyGuardians) {
            query = await refSpace.collection(SUB_COL.GUARDIANS).get();
          } else {
            query = await refSpace.collection(SUB_COL.MEMBERS).get();
          }
          for (const g of query.docs) {
            // Based on the subtype we determine number of voting power.
            let votingWeight = 1;
            if (
              params.body.subType === ProposalSubType.REPUTATION_BASED_ON_SPACE ||
              params.body.subType === ProposalSubType.REPUTATION_BASED_ON_SPACE_WITH_ALLIANCE ||
              params.body.subType === ProposalSubType.REPUTATION_BASED_ON_AWARDS
            ) {
              const qry = await admin
                .firestore()
                .collection(COL.TRANSACTION)
                .where('type', '==', TransactionType.BADGE)
                .where('member', '==', g.data().uid)
                .get();
              if (qry.size > 0) {
                let totalReputation = 0;
                for (const t of qry.docs) {
                  if (params.body.subType === ProposalSubType.REPUTATION_BASED_ON_AWARDS) {
                    // We only consider certain badges coming from certain awards.
                    if (params.body.settings.awards.includes(t.data().payload.award)) {
                      totalReputation += t.data().payload?.xp || 0;
                    }
                  } else if (t.data().space === docSpace.data().uid) {
                    const repo: number = t.data().payload?.xp || 0;
                    totalReputation += Math.trunc(repo);
                  }
                }

                votingWeight = totalReputation;
              } else {
                votingWeight = 0;
              }
            }

            // Respect defaultMinWeight.
            if (
              params.body.settings.defaultMinWeight > 0 &&
              votingWeight < params.body.settings.defaultMinWeight
            ) {
              votingWeight = params.body.settings.defaultMinWeight;
            }

            if (votingWeight > 0) {
              await refProposal
                .collection(SUB_COL.MEMBERS)
                .doc(g.data().uid)
                .set(
                  cOn({
                    uid: g.data().uid,
                    weight: votingWeight,
                    voted: false,
                    parentId: proposalAddress,
                    parentCol: COL.PROPOSAL,
                  }),
                );
            }

            totalWeight += votingWeight;
          }
        }

        await refProposal.update(
          uOn({
            totalWeight: totalWeight,
          }),
        );

        // Set owner.
        await refProposal
          .collection(SUB_COL.OWNERS)
          .doc(owner)
          .set(
            cOn({
              uid: owner,
              parentId: proposalAddress,
              parentCol: COL.PROPOSAL,
            }),
          );

        // Load latest
        docProposal = await refProposal.get();
      }

      // Return member.
      return <Proposal>docProposal.data();
    },
  );

export const approveProposal: functions.CloudFunction<Proposal> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.aProposal),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.aProposal, context);
      // Validate auth details before we continue
      const params = await decodeAuth(req, WEN_FUNC.aProposal);
      const owner = params.address.toLowerCase();
      const schema: ObjectSchema<Proposal> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uid(),
        }),
      );
      await assertValidationAsync(schema, params.body);

      const refProposal: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.PROPOSAL)
        .doc(params.body.uid);
      const docProposal: DocumentSnapshotType = await refProposal.get();
      let docTran!: DocumentSnapshotType;
      if (!docProposal.exists) {
        throw throwInvalidArgument(WenError.proposal_does_not_exists);
      }

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(docProposal.data().space);
      if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).get()).exists) {
        throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
      }

      if (docProposal.data().approved) {
        throw throwInvalidArgument(WenError.proposal_is_already_approved);
      }

      if (params.body) {
        await refProposal.update(
          uOn({
            approved: true,
            approvedBy: owner,
          }),
        );

        // Load latest
        docTran = await refProposal.get();
      }

      return docTran.data();
    },
  );

export const rejectProposal: functions.CloudFunction<Proposal> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.rProposal),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.rProposal, context);
      // Validate auth details before we continue
      const params = await decodeAuth(req, WEN_FUNC.rProposal);
      const owner = params.address.toLowerCase();
      const schema: ObjectSchema<Proposal> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uid(),
        }),
      );
      await assertValidationAsync(schema, params.body);

      const refProposal: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.PROPOSAL)
        .doc(params.body.uid);
      const docProposal: DocumentSnapshotType = await refProposal.get();
      let docTran!: DocumentSnapshotType;
      if (!docProposal.exists) {
        throw throwInvalidArgument(WenError.proposal_does_not_exists);
      }

      const refSpace: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.SPACE)
        .doc(docProposal.data().space);
      if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).get()).exists) {
        throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
      }

      if (docProposal.data().approved) {
        throw throwInvalidArgument(WenError.proposal_is_already_approved);
      }

      if (docProposal.data().rejected) {
        throw throwInvalidArgument(WenError.proposal_is_already_rejected);
      }

      if (params.body) {
        await refProposal.update(
          uOn({
            rejected: true,
            rejectedBy: owner,
          }),
        );

        // Load latest
        docTran = await refProposal.get();
      }

      return docTran.data();
    },
  );

export const voteOnProposal: functions.CloudFunction<Proposal> = functions
  .runWith({
    minInstances: scale(WEN_FUNC.voteOnProposal),
  })
  .https.onCall(
    async (
      req: WenRequest,
      context: functions.https.CallableContext,
    ): Promise<StandardResponse> => {
      appCheck(WEN_FUNC.voteOnProposal, context);
      const params = await decodeAuth(req, WEN_FUNC.voteOnProposal);
      const owner = params.address.toLowerCase();
      const schema: ObjectSchema<Proposal> = Joi.object(
        merge(getDefaultParams(), {
          uid: CommonJoi.uid(),
          // TODO Validate across multiple questions.
          values: Joi.array().items(Joi.number()).min(1).max(1).unique().required(),
        }),
      );
      await assertValidationAsync(schema, params.body);

      const refProposal: admin.firestore.DocumentReference = admin
        .firestore()
        .collection(COL.PROPOSAL)
        .doc(params.body.uid);
      const docProposal: DocumentSnapshotType = await refProposal.get();
      let docTran!: DocumentSnapshotType;
      if (!docProposal.exists) {
        throw throwInvalidArgument(WenError.proposal_does_not_exists);
      }

      const refMember: admin.firestore.DocumentReference = refProposal
        .collection(SUB_COL.MEMBERS)
        .doc(owner);
      const docMember: DocumentSnapshotType = await refMember.get();
      if (!docMember.exists) {
        throw throwInvalidArgument(WenError.you_are_not_allowed_to_vote_on_this_proposal);
      }

      if (docProposal.data().rejected) {
        throw throwInvalidArgument(WenError.proposal_is_rejected);
      }

      if (!docProposal.data().approved) {
        throw throwInvalidArgument(WenError.proposal_is_not_approved);
      }

      if (docProposal.data().type === ProposalType.NATIVE) {
        throw throwInvalidArgument(WenError.you_can_only_vote_on_members_proposal);
      }

      // Validate if proposal can still be voted on.
      const startDate: dayjs.Dayjs = dayjs(docProposal.data().settings.startDate.toDate());
      const endDate: dayjs.Dayjs = dayjs(docProposal.data().settings.endDate.toDate());
      if (dayjs().isBefore(startDate) || dayjs().isAfter(endDate)) {
        throw throwInvalidArgument(WenError.vote_is_no_longer_active);
      }

      if (endDate.isBefore(startDate)) {
        throw throwInvalidArgument(WenError.proposal_start_date_must_be_before_end_date);
      }

      const answers: number[] = [];
      docProposal.data().questions.forEach((q: ProposalQuestion) => {
        q.answers.forEach((a: ProposalAnswer) => {
          answers.push(a.value);
        });
      });

      const found = ((<ProposalMember>params.body).values || []).some((r) => {
        return answers.includes(r);
      });

      if (!found) {
        throw throwInvalidArgument(WenError.value_does_not_exists_in_proposal);
      }

      if (params.body) {
        // This this member already voted? New transaction will be valid. Historical one will be ineffective.
        const tranId: string = getRandomEthAddress();
        const refTran: admin.firestore.DocumentReference = admin
          .firestore()
          .collection(COL.TRANSACTION)
          .doc(tranId);
        await refTran.set(
          cOn(<Transaction>{
            type: TransactionType.VOTE,
            uid: tranId,
            member: owner,
            space: docProposal.data().space,
            network: DEFAULT_NETWORK,
            payload: <VoteTransaction>{
              proposalId: params.body.uid,
              weight: docMember.data().weight || 0,
              values: params.body.values,
              votes: [],
            },
            linkedTransactions: [],
          }),
        );

        // Mark participant that completed the vote.
        await refMember.update(
          uOn({
            voted: true,
            tranId: tranId,
            values: params.body.values.map((v: number) => {
              const obj = {} as { [key: number]: number };
              obj[v] = docMember.data().weight || 0;
              return obj;
            }),
          }),
        );

        const results = {} as { [key: string]: number };
        let voted = 0;
        let total = 0;
        const allMembers = await refProposal.collection(SUB_COL.MEMBERS).get();
        for (const doc of allMembers.docs) {
          // Total is based on number of questions.
          total += doc.data().weight * docProposal.data().questions.length;

          if (doc.data().voted && doc.data().values && doc.data().values.length > 0) {
            // Voted.
            voted += doc.data().weight * docProposal.data().questions.length;

            // We add weight to each answer.
            (<ProposalMember>doc.data()).values?.forEach((obj) => {
              Object.keys(obj).forEach((k) => {
                results[k] = results[k] || 0;
                results[k] += doc.data().weight;
              });
            });
          }
        }

        await refProposal.update(
          uOn({
            results: {
              total: total,
              voted: voted,
              answers: results,
            },
          }),
        );

        // Load latest
        docTran = await refTran.get();
      }

      if (RelatedRecordsResponse.status) {
        return {
          ...docTran.data(),
          ...{
            _relatedRecs: {
              proposal: (await refProposal.get()).data(),
            },
          },
        };
      } else {
        return docTran.data();
      }
    },
  );
