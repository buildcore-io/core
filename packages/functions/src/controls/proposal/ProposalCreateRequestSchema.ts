import { ProposalCreateRequest, ProposalStartDateMin, ProposalType } from '@buildcore/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../services/joi/common';
import { isProdEnv } from '../../utils/config.utils';

export const createProposalSchema = {
  name: Joi.string().required().description('Name of the proposal'),
  description: Joi.string().allow(null, '').optional().description('Description of the proposal'),
  space: CommonJoi.uid().description(
    'Buildcore id of the space where the proposal should be created.',
  ),
  additionalInfo: Joi.string()
    .allow(null, '')
    .optional()
    .description('Additional information about the proposal.'),
  type: Joi.number()
    .equal(ProposalType.MEMBERS, ProposalType.NATIVE)
    .required()
    .description('Type of the proposal.'),
  settings: Joi.object({
    startDate: Joi.date()
      .greater(Date.now() + (isProdEnv() ? ProposalStartDateMin.value : -600000))
      .required()
      .description(
        `Starting date of the proposal. Has to be at least ${ProposalStartDateMin.value} milliseconds in the future`,
      ),
    endDate: Joi.date()
      .greater(Joi.ref('startDate'))
      .required()
      .description('End date of the proposal. Has to be after start date.'),
    onlyGuardians: Joi.boolean()
      .required()
      .description('Set true if only guardians can vote on this proposal'),
  })
    .required()
    .description('Settings object of the proposal'),
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

export const proposalCreateSchemaObject = toJoiObject<ProposalCreateRequest>(createProposalSchema)
  .description('Request object to create a proposal')
  .meta({
    className: 'ProposalCreateRequest',
  });
