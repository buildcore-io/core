import {
  ProposalStartDateMin,
  ProposalSubType,
  ProposalType,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import Joi from 'joi';
import { createProposalControl } from '../../../controls/proposal/create.proposal';
import { onCall } from '../../../firebase/functions/onCall';
import { CommonJoi } from '../../../services/joi/common';
import { isProdEnv } from '../../../utils/config.utils';

export const createProposalSchema = {
  name: Joi.string().required(),
  space: CommonJoi.uid(),
  additionalInfo: Joi.string().allow(null, '').optional(),
  type: Joi.number().equal(ProposalType.MEMBERS, ProposalType.NATIVE).required(),
  subType: Joi.when('type', {
    is: Joi.exist().valid(ProposalType.NATIVE),
    then: Joi.number().equal(ProposalSubType.ONE_MEMBER_ONE_VOTE).required(),
    otherwise: Joi.number()
      .equal(
        ProposalSubType.ONE_MEMBER_ONE_VOTE,
        ProposalSubType.REPUTATION_BASED_ON_AWARDS,
        ProposalSubType.REPUTATION_BASED_ON_SPACE,
      )
      .required(),
  }),
  settings: Joi.object({
    startDate: isProdEnv()
      ? Joi.date()
          .greater(Date.now() + ProposalStartDateMin.value)
          .required()
      : Joi.date().required(),
    endDate: Joi.date().greater(Joi.ref('startDate')).required(),
    onlyGuardians: Joi.boolean().required(),
    awards: Joi.when('...subType', {
      is: Joi.exist().valid(ProposalSubType.REPUTATION_BASED_ON_AWARDS),
      then: Joi.array().items(CommonJoi.uid(false)).min(1).required(),
      otherwise: Joi.forbidden(),
    }),
    defaultMinWeight: Joi.when('...subType', {
      is: Joi.exist().valid(
        ProposalSubType.REPUTATION_BASED_ON_SPACE,
        ProposalSubType.REPUTATION_BASED_ON_AWARDS,
      ),
      then: Joi.number().optional(),
      otherwise: Joi.forbidden(),
    }),
  }).required(),
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
};

export const createProposal = onCall(WEN_FUNC.cProposal, {
  timeoutSeconds: 300,
  memory: '2GB',
})(Joi.object(createProposalSchema), createProposalControl);
