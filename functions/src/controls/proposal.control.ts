import { QuerySnapshot } from "@firebase/firestore";
import dayjs from 'dayjs';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { WenError } from '../../interfaces/errors';
import { DecodedToken, StandardResponse } from '../../interfaces/functions/index';
import { COL, SUB_COL, WenRequest } from '../../interfaces/models/base';
import { Proposal } from '../../interfaces/models/proposal';
import { cOn, dateToTimestamp, serverTime, uOn } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { assertValidation, getDefaultParams } from "../utils/schema.utils";
import { cleanParams, decodeAuth, ethAddressLength, getRandomEthAddress } from "../utils/wallet.utils";
import { ProposalStartDateMin, RelatedRecordsResponse } from './../../interfaces/config';
import { ProposalAnswer, ProposalQuestion, ProposalSubType, ProposalType } from './../../interfaces/models/proposal';
import { Transaction, TransactionType } from './../../interfaces/models/transaction';

function defaultJoiUpdateCreateSchema(): any {
  return merge(getDefaultParams(), {
    name: Joi.string().required(),
    space: Joi.string().length(ethAddressLength).lowercase().required(),
    additionalInfo: Joi.string().allow(null, '').optional(),
    type: Joi.number().equal(ProposalType.MEMBERS, ProposalType.NATIVE).required(),
    subType: Joi.when('type', {
      is: Joi.exist().valid(ProposalType.NATIVE),
      then: Joi.number().equal(ProposalSubType.ONE_ADDRESS_ONE_VOTE).required(),
      otherwise: Joi.number().equal(
        ProposalSubType.ONE_MEMBER_ONE_VOTE,
        ProposalSubType.REPUTATION_BASED_ON_AWARDS,
        ProposalSubType.REPUTATION_BASED_ON_SPACE
      ).required()
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
        startDate: Joi.date().greater(Date.now() + ProposalStartDateMin.value).required(),
        endDate: Joi.date().greater(Joi.ref('startDate')).required(),
        onlyGuardians: Joi.boolean().required(),
        awards: Joi.when('subType', {
          is: Joi.exist().valid(ProposalSubType.REPUTATION_BASED_ON_AWARDS),
          then: Joi.array().items(Joi.string().length(ethAddressLength).lowercase()).min(1).required(),
        })
      }).required()
    }),
    questions: Joi.array().items(Joi.object().keys({
      text: Joi.string().required(),
      additionalInfo: Joi.string().allow(null, '').optional(),
      answers: Joi.array().items(Joi.object().keys({
        value: Joi.number().required(),
        text: Joi.string().required(),
        additionalInfo: Joi.string().allow(null, '').optional(),
      })).min(2).required()
    // To enable more questions, fix front-end. Also tweak voteOnProposal to validate.
    })).min(1).max(1).required()
  });
}

export const createProposal: functions.CloudFunction<Proposal> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: 1,
}).https.onCall(async (req: WenRequest): Promise<Proposal> => {
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();

  // We only get random address here that we use as ID.
  const proposalAddress: string = getRandomEthAddress();

  const schema: ObjectSchema<Proposal> = Joi.object(defaultJoiUpdateCreateSchema());
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.space);
  if (!(await refSpace.get()).exists) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  if (!(await refSpace.collection(SUB_COL.MEMBERS).doc(owner).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_part_of_space);
  }

  if (params.body.settings?.startDate) {
    params.body.settings.startDate = dateToTimestamp(params.body.settings.startDate);
  }

  if (params.body.settings?.endDate) {
    params.body.settings.endDate = dateToTimestamp(params.body.settings.endDate);
  }

  const refProposal: any = admin.firestore().collection(COL.PROPOSAL).doc(proposalAddress);
  let docProposal = await refProposal.get();
  if (!docProposal.exists) {
    // Document does not exists.
    await refProposal.set(cOn(merge(cleanParams(params.body), {
      uid: proposalAddress,
      rank: 1,
      createdBy: owner
    })));

    // This can't be empty.
    // Add Owners based on space's guardians or members.
    let query: QuerySnapshot;
    if (params.body.onlyGuardians) {
      query = await refSpace.collection(SUB_COL.GUARDIANS).get();
    } else {
      query = await refSpace.collection(SUB_COL.MEMBERS).get();
    }
    let totalWeight = 0;
    for (const g of query.docs) {
      // Based on the subtype we determine number of voting power.
      let votingWeight = 1;
      if (params.body.subType === ProposalSubType.REPUTATION_BASED_ON_SPACE ||  params.body.subType === ProposalSubType.REPUTATION_BASED_ON_AWARDS) {
        const qry = await admin.firestore().collection(COL.TRANSACTION)
                    .where('type', '==', TransactionType.BADGE)
                    .where('member', '==', g.data().uid).get();
        if (qry.size > 0) {
          let totalReputation = 0;
          for (const t of qry.docs) {
            if (params.body.subType === ProposalSubType.REPUTATION_BASED_ON_AWARDS) {
              // We only consider certain badges coming from certain awards.
              if (params.body.settings.awards.includes(t.data().payload.award)) {
                totalReputation += t.data().payload?.xp || 0;
              }
            } else {
              totalReputation += t.data().payload?.xp || 0;
            }
          }

          votingWeight = totalReputation;
        } else {
          votingWeight = 0;
        }
      }

      await refProposal.collection(SUB_COL.MEMBERS).doc(g.data().uid).set({
        uid: g.data().uid,
        weight: votingWeight,
        parentId: proposalAddress,
        parentCol: COL.PROPOSAL,
        createdOn: serverTime()
      });

      totalWeight += votingWeight;
    }

    await refProposal.update({
      totalWeight: totalWeight
    });

    // Set owner.
    await refProposal.collection(SUB_COL.OWNERS).doc(owner).set({
      uid: owner,
      parentId: proposalAddress,
      parentCol: COL.PROPOSAL,
      createdOn: serverTime()
    });

    // Load latest
    docProposal = await refProposal.get();
  }


  // Return member.
  return <Proposal>docProposal.data();
});

export const approveProposal: functions.CloudFunction<Proposal> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: 1,
}).https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema: ObjectSchema<Proposal> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refProposal: any = admin.firestore().collection(COL.PROPOSAL).doc(params.body.uid);
  const docProposal: any = await refProposal.get();
  let docTran: any;
  if (!docProposal.exists) {
    throw throwInvalidArgument(WenError.proposal_does_not_exists);
  }

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(docProposal.data().space);
  if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(owner).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }

  if (docProposal.data().approved) {
    throw throwInvalidArgument(WenError.proposal_is_already_approved);
  }

  if (params.body) {
    await refProposal.update(uOn({
      approved: true,
      approvedBy: owner
    }));

    // Load latest
    docTran = await refProposal.get();
  }

  return docTran.data();
});

export const rejectProposal: functions.CloudFunction<Proposal> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: 1,
}).https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  // We must part
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema: ObjectSchema<Proposal> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required()
  }));
  assertValidation(schema.validate(params.body));

  const refProposal: any = admin.firestore().collection(COL.PROPOSAL).doc(params.body.uid);
  const docProposal: any = await refProposal.get();
  let docTran: any;
  if (!docProposal.exists) {
    throw throwInvalidArgument(WenError.proposal_does_not_exists);
  }

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(docProposal.data().space);
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
    await refProposal.update(uOn({
      rejected: true,
      rejectedBy: owner
    }));

    // Load latest
    docTran = await refProposal.get();
  }

  return docTran.data();
});

export const voteOnProposal: functions.CloudFunction<Proposal> = functions.runWith({
  // Keep 1 instance so we never have cold start.
  minInstances: 1,
}).https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
  const params: DecodedToken = await decodeAuth(req);
  const owner = params.address.toLowerCase();
  const schema: ObjectSchema<Proposal> = Joi.object(merge(getDefaultParams(), {
      uid: Joi.string().length(ethAddressLength).lowercase().required(),
      // TODO Validate across multiple questions.
      values: Joi.array().items(Joi.number()).min(1).max(1).unique().required()
  }));
  assertValidation(schema.validate(params.body));

  const refProposal: any = admin.firestore().collection(COL.PROPOSAL).doc(params.body.uid);
  const docProposal: any = await refProposal.get();
  let docTran: any;
  if (!docProposal.exists) {
    throw throwInvalidArgument(WenError.proposal_does_not_exists);
  }

  const refMember: any = refProposal.collection(SUB_COL.MEMBERS).doc(owner);
  const docMember: any = await refMember.get();
  if (!docMember.exists) {
    throw throwInvalidArgument(WenError.you_are_not_allowed_to_vote_on_this_proposal);
  }

  if (!docProposal.data().approved) {
    throw throwInvalidArgument(WenError.proposal_is_not_approved);
  }

  if (docProposal.data().rejected) {
    throw throwInvalidArgument(WenError.proposal_is_rejected);
  }

  if (docProposal.data().type !== ProposalType.MEMBERS) {
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

  const found: boolean = params.body.values.some((r: any) => {
    return answers.includes(r);
  });

  if (!found) {
    throw throwInvalidArgument(WenError.value_does_not_exists_in_proposal);
  }

  if (params.body) {
    // This this member already voted? New transaction will be valid. Historical one will be ineffective.
    const tranId: string = getRandomEthAddress();
    const refTran: any = admin.firestore().collection(COL.TRANSACTION).doc(tranId);
    await refTran.set(<Transaction>{
      type: TransactionType.VOTE,
      uid: tranId,
      member: owner,
      space: docProposal.data().space,
      createdOn: serverTime(),
      payload: {
        proposalId: params.body.uid,
        weight: docMember.data().weight || 0,
        values: params.body.values
      }
    });

    // Mark participant that completed the vote.
    await refMember.update({
      voted: true,
      tranId: tranId,
      values: params.body.values.map((v: number) => {
        const obj: any = {};
        obj[v] = docMember.data().weight || 0;
        return obj;
      })
    });

    const results: any = {};
    let voted = 0;
    let total = 0;
    const allMembers: any = await refProposal.collection(SUB_COL.MEMBERS).get();
    for (const doc of allMembers.docs) {
      // Total is based on number of questions.
      total += doc.data().weight * docProposal.data().questions.length;

      if (doc.data().voted && doc.data().values && doc.data().values.length > 0) {
        // Voted.
        voted += doc.data().weight * docProposal.data().questions.length;

        // We add weight to each answer.
        doc.data().values.forEach((obj: any) => {
          Object.keys(obj).forEach((k) => {
            results[k]  = results[k] || 0;
            results[k] += doc.data().weight;
          });
        });
      }
    }

    await refProposal.update({
      results: {
        total: total,
        voted: voted,
        answers: results
      }
    });

    // Load latest
    docTran = await refTran.get();
  }

  if (RelatedRecordsResponse.status) {
    return {
      ...docTran.data(),
      ...{
        _relatedRecs: {
          proposal: (await refProposal.get()).data()
        }
      }
    }
  } else {
    return docTran.data();
  }
});

