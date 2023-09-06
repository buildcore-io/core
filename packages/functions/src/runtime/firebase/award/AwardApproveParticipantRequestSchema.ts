import { AwardApproveParticipantRequest } from '@build-5/interfaces';
import Joi from 'joi';
import { CommonJoi, toJoiObject } from '../../../services/joi/common';

const MIN_MEMBERS = 1;
const MAX_MEMBERS = 1000;

export const approveAwardParticipantSchema = {
  award: CommonJoi.uid().description('Build5 id of the award'),
  members: Joi.array()
    .items(CommonJoi.uid())
    .min(MIN_MEMBERS)
    .max(MAX_MEMBERS)
    .required()
    .description(
      'Build5 id or wallet address of the participants to approve. ' +
        `Minimum ${MIN_MEMBERS}, maximum ${MAX_MEMBERS}`,
    ),
};

export const approveAwardParticipantSchemaObject = toJoiObject<AwardApproveParticipantRequest>(
  approveAwardParticipantSchema,
)
  .description('Request object to approve participants for an award.')
  .meta({
    className: 'AwardApproveParticipantRequest',
  });
