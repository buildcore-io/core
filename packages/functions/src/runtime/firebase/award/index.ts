import { AwardType, WEN_FUNC } from '@soonaverse/interfaces';
import { cid } from 'is-ipfs';
import Joi from 'joi';
import { approveAwardControl } from '../../../controls/award/award.approve';
import { approveAwardParticipantControl } from '../../../controls/award/award.approve.participant';
import { createAwardControl } from '../../../controls/award/award.create';
import { addOwnerControl } from '../../../controls/award/award.owner';
import { awardParticipateControl } from '../../../controls/award/award.participate';
import { rejectAwardControl } from '../../../controls/award/award.reject';
import { onCall } from '../../../firebase/functions/onCall';
import { CommonJoi } from '../../../services/joi/common';
import { uidSchema } from '../common';

const createAwardSchema = Joi.object({
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
export const createAward = onCall(WEN_FUNC.cAward)(createAwardSchema, createAwardControl);

const addOwnerSchema = Joi.object({ uid: CommonJoi.uid(), member: CommonJoi.uid() });
export const addOwnerAward = onCall(WEN_FUNC.addOwnerAward)(addOwnerSchema, addOwnerControl);

export const approveAward = onCall(WEN_FUNC.aAward)(uidSchema, approveAwardControl);
export const rejectAward = onCall(WEN_FUNC.rAward)(uidSchema, rejectAwardControl);

const awardParticipateSchema = Joi.object({
  uid: CommonJoi.uid(),
  comment: Joi.string().allow(null, '').optional(),
});
export const awardParticipate = onCall(WEN_FUNC.participateAward)(
  awardParticipateSchema,
  awardParticipateControl,
);

const approveAwardParticipantSchema = Joi.object({ uid: CommonJoi.uid(), member: CommonJoi.uid() });
export const approveAwardParticipant = onCall(WEN_FUNC.aParticipantAward)(
  approveAwardParticipantSchema,
  approveAwardParticipantControl,
);
