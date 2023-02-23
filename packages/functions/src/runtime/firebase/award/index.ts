import { MAX_IOTA_AMOUNT, WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { approveAwardParticipantControl } from '../../../controls/award/award.approve.participant';
import { cancelAwardControl } from '../../../controls/award/award.cancel';
import { createAwardControl } from '../../../controls/award/award.create';
import { fundAwardControl } from '../../../controls/award/award.fund';
import { addOwnerControl } from '../../../controls/award/award.owner';
import { awardParticipateControl } from '../../../controls/award/award.participate';
import { rejectAwardControl } from '../../../controls/award/award.reject';
import { AVAILABLE_NETWORKS } from '../../../controls/common';
import { onCall } from '../../../firebase/functions/onCall';
import { CommonJoi } from '../../../services/joi/common';
import { uidSchema } from '../common';

const createAwardSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow(null, '').optional(),
  space: CommonJoi.uid(),
  endDate: Joi.date().required(),
  badge: Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow(null, '').optional(),
    total: Joi.number().min(1).max(10000).integer().required(),
    // TODO We might need to fix tests. Image must be mandatory.
    image: CommonJoi.storageUrl(),
    tokenReward: Joi.number().min(0).max(MAX_IOTA_AMOUNT).integer().required(),
    tokenSymbol: CommonJoi.tokenSymbol(),
    lockTime: Joi.number().min(0).integer().required(),
  }),
  network: Joi.string()
    .equal(...AVAILABLE_NETWORKS)
    .required(),
});
export const createAward = onCall(WEN_FUNC.cAward)(createAwardSchema, createAwardControl);

const addOwnerSchema = Joi.object({ uid: CommonJoi.uid(), member: CommonJoi.uid() });
export const addOwnerAward = onCall(WEN_FUNC.addOwnerAward)(addOwnerSchema, addOwnerControl);

export const fundAward = onCall(WEN_FUNC.fundAward)(uidSchema, fundAwardControl);
export const rejectAward = onCall(WEN_FUNC.rAward)(uidSchema, rejectAwardControl);
export const cancelAward = onCall(WEN_FUNC.cancelAward)(uidSchema, cancelAwardControl);

const awardParticipateSchema = Joi.object({
  uid: CommonJoi.uid(),
  comment: Joi.string().allow(null, '').optional(),
});
export const awardParticipate = onCall(WEN_FUNC.participateAward)(
  awardParticipateSchema,
  awardParticipateControl,
);

const approveAwardParticipantSchema = Joi.object({
  award: CommonJoi.uid(),
  members: Joi.array().items(CommonJoi.uid()).min(1).max(1000).required(),
});
export const approveAwardParticipant = onCall(WEN_FUNC.aParticipantAward)(
  approveAwardParticipantSchema,
  approveAwardParticipantControl,
);
