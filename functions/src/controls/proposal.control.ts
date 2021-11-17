import { QuerySnapshot } from "@firebase/firestore";
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import Joi, { ObjectSchema } from "joi";
import { merge } from 'lodash';
import { WenError } from '../../interfaces/errors';
import { DecodedToken, StandardResponse } from '../../interfaces/functions/index';
import { COL, SUB_COL, WenRequest } from '../../interfaces/models/base';
import { Proposal } from '../../interfaces/models/proposal';
import { cOn, serverTime, uOn } from "../utils/dateTime.utils";
import { throwInvalidArgument } from "../utils/error.utils";
import { assertValidation, getDefaultParams } from "../utils/schema.utils";
import { cleanParams, decodeAuth, ethAddressLength, getRandomEthAddress } from "../utils/wallet.utils";
import { ProposalType } from './../../interfaces/models/proposal';

function defaultJoiUpdateCreateSchema(): any {
  return merge(getDefaultParams(), {
    name: Joi.string().required(),
    space: Joi.string().length(ethAddressLength).lowercase().required(),
    additionalInfo: Joi.string().allow(null, '').optional(),
    type: Joi.number().equal(ProposalType.MEMBERS, ProposalType.NATIVE).required(),
    settings: Joi.alternatives().try(Joi.object({
      milestoneIndexCommence: Joi.number().required(),
      milestoneIndexStart: Joi.number().greater(Joi.ref('milestoneIndexCommence')).required(),
      milestoneIndexEnd: Joi.number().greater(Joi.ref('milestoneIndexStart')).required(),
    }), Joi.object({
      startDate: Joi.date().required(),
      endDate: Joi.date().required(),
      members: Joi.array().items(
        Joi.string().length(ethAddressLength).lowercase().required()
      ).required(),
    })),
    questions: Joi.array().items(Joi.object().keys({
      text: Joi.string().required(),
      additionalInfo: Joi.string().allow(null, '').optional(),
      answers: Joi.array().items(Joi.object().keys({
        value: Joi.number().required(),
        text: Joi.string().required(),
        additionalInfo: Joi.string().allow(null, '').optional(),
      })).min(2).required()
    })).min(1).required()
  });
}

export const createProposal: functions.CloudFunction<Proposal> = functions.https.onCall(async (req: WenRequest): Promise<Proposal> => {
  const params: DecodedToken = await decodeAuth(req);
  const guardian = params.address.toLowerCase();

  // We only get random address here that we use as ID.
  const proposalAddress: string = getRandomEthAddress();

  const schema: ObjectSchema<Proposal> = Joi.object(defaultJoiUpdateCreateSchema());
  assertValidation(schema.validate(params.body));

  const refSpace: any = admin.firestore().collection(COL.SPACE).doc(params.body.space);
  if (!(await refSpace.get()).exists) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  if (!(await refSpace.collection(SUB_COL.GUARDIANS).doc(guardian).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_guardian_of_space);
  }

  const refProposal: any = admin.firestore().collection(COL.PROPOSAL).doc(proposalAddress);
  let docProposal = await refProposal.get();
  if (!docProposal.exists) {
    // Document does not exists.
    await refProposal.set(cOn(merge(cleanParams(params.body), {
      uid: proposalAddress,
      createdBy: guardian
    })));

    // This can't be empty.
    // Add Owners based on space's guardians.
    const query: QuerySnapshot = await refSpace.collection(SUB_COL.GUARDIANS).get();
    query.forEach(async (g) => {
      await refProposal.collection(SUB_COL.OWNERS).doc(g.data().uid).set({
        uid: g.data().uid,
        parentId: proposalAddress,
        parentCol: COL.PROPOSAL,
        createdOn: serverTime()
      });
    });

    // Load latest
    docProposal = await refProposal.get();
  }


  // Return member.
  return <Proposal>docProposal.data();
});

export const approveProposal: functions.CloudFunction<Proposal> = functions.https.onCall(async (req: WenRequest): Promise<StandardResponse> => {
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

  if (!(await refProposal.collection(SUB_COL.OWNERS).doc(owner).get()).exists) {
    throw throwInvalidArgument(WenError.you_are_not_owner_of_proposal);
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

