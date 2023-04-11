import { ProposalStartDateMin, ProposalType, WEN_FUNC } from '@soonaverse/interfaces';
import Joi from 'joi';
import { proposalApprovalControl } from '../../../controls/proposal/approve.reject.proposal';
import { createProposalControl } from '../../../controls/proposal/create.proposal';
import { voteOnProposalControl } from '../../../controls/proposal/vote.on.proposal';
import { onRequest } from '../../../firebase/functions/onRequest';
import { CommonJoi } from '../../../services/joi/common';
import { isProdEnv } from '../../../utils/config.utils';
import { uidSchema } from '../common';

export const createProposalSchema = {
  name: Joi.string().required(),
  space: CommonJoi.uid(),
  additionalInfo: Joi.string().allow(null, '').optional(),
  type: Joi.number().equal(ProposalType.MEMBERS, ProposalType.NATIVE).required(),
  settings: Joi.object({
    startDate: isProdEnv()
      ? Joi.date()
          .greater(Date.now() + ProposalStartDateMin.value)
          .required()
      : Joi.date().required(),
    endDate: Joi.date().greater(Joi.ref('startDate')).required(),
    onlyGuardians: Joi.boolean().required(),
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

export const createProposal = onRequest(WEN_FUNC.cProposal, {
  timeoutSeconds: 300,
  memory: '2GiB',
})(Joi.object(createProposalSchema), createProposalControl);

export const approveProposal = onRequest(WEN_FUNC.aProposal)(
  uidSchema,
  proposalApprovalControl(true),
);

export const rejectProposal = onRequest(WEN_FUNC.rProposal)(
  uidSchema,
  proposalApprovalControl(false),
);

export const voteOnProposalSchema = Joi.object({
  uid: CommonJoi.uid(),
  values: Joi.array().items(Joi.number()).min(1).max(1).unique().required(),
  voteWithStakedTokes: Joi.bool().optional(),
});

export const voteOnProposal = onRequest(WEN_FUNC.voteOnProposal)(
  voteOnProposalSchema,
  voteOnProposalControl,
);
