import { MAX_IOTA_AMOUNT, WEN_FUNC } from '@build-5/interfaces';
import Joi from 'joi';
import { approveAwardParticipantControl } from '../../../controls/award/award.approve.participant';
import { cancelAwardControl } from '../../../controls/award/award.cancel';
import { createAwardControl } from '../../../controls/award/award.create';
import { fundAwardControl } from '../../../controls/award/award.fund';
import { addOwnerControl } from '../../../controls/award/award.owner';
import { awardParticipateControl } from '../../../controls/award/award.participate';
import { rejectAwardControl } from '../../../controls/award/award.reject';
import { AVAILABLE_NETWORKS } from '../../../controls/common';
import { onRequest } from '../../../firebase/functions/onRequest';
import { CommonJoi } from '../../../services/joi/common';
import { uidSchema } from '../common';

export const awardBageSchema = {
  name: Joi.string().required(),
  description: Joi.string().allow(null, '').optional(),
  total: Joi.number().min(1).max(10000).integer().required(),
  image: CommonJoi.storageUrl(),
  tokenReward: Joi.number().min(0).max(MAX_IOTA_AMOUNT).integer().required(),
  tokenSymbol: CommonJoi.tokenSymbol(),
  lockTime: Joi.number().min(0).integer().required(),
};
export const createAwardSchema = (badgeSchema = awardBageSchema) =>
  Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow(null, '').optional(),
    space: CommonJoi.uid(),
    endDate: Joi.date().required(),
    badge: Joi.object(badgeSchema),
    network: Joi.string()
      .equal(...AVAILABLE_NETWORKS)
      .required(),
  });
export const createAward = onRequest(WEN_FUNC.createAward)(createAwardSchema(), createAwardControl);

const addOwnerSchema = Joi.object({ uid: CommonJoi.uid(), member: CommonJoi.uid() });
export const addOwnerAward = onRequest(WEN_FUNC.addOwnerAward)(addOwnerSchema, addOwnerControl);

export const fundAward = onRequest(WEN_FUNC.fundAward)(uidSchema, fundAwardControl);
export const rejectAward = onRequest(WEN_FUNC.rejectAward)(uidSchema, rejectAwardControl);
export const cancelAward = onRequest(WEN_FUNC.cancelAward)(uidSchema, cancelAwardControl);

const awardParticipateSchema = Joi.object({
  uid: CommonJoi.uid(),
  comment: Joi.string().allow(null, '').optional(),
});
export const awardParticipate = onRequest(WEN_FUNC.participateAward)(
  awardParticipateSchema,
  awardParticipateControl,
);

export const approveAwardParticipantSchema = Joi.object({
  award: CommonJoi.uid(),
  members: Joi.array().items(CommonJoi.uid()).min(1).max(1000).required(),
});
export const approveAwardParticipant = onRequest(WEN_FUNC.approveParticipantAward, {
  timeoutSeconds: 540,
  memory: '4GiB',
})(approveAwardParticipantSchema, approveAwardParticipantControl);
