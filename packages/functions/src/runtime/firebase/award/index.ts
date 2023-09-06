import { WEN_FUNC } from '@build-5/interfaces';
import { approveAwardParticipantControl } from '../../../controls/award/award.approve.participant';
import { cancelAwardControl } from '../../../controls/award/award.cancel';
import { createAwardControl } from '../../../controls/award/award.create';
import { fundAwardControl } from '../../../controls/award/award.fund';
import { addOwnerControl } from '../../../controls/award/award.owner';
import { awardParticipateControl } from '../../../controls/award/award.participate';
import { rejectAwardControl } from '../../../controls/award/award.reject';
import { onRequest } from '../../../firebase/functions/onRequest';
import { addOwnerSchema } from './AwardAddOwnerRequestSchema';
import { approveAwardParticipantSchemaObject } from './AwardApproveParticipantRequestSchema';
import { awardCancelSchema } from './AwardCancelRequestSchema';
import { awardCreateSchemaObject } from './AwardCreateRequestSchema';
import { awardFundSchema } from './AwardFundRequestSchema';
import { awardParticipateSchema } from './AwardParticipateRequestSchema';
import { awardRejectSchema } from './AwardRejectRequestSchema';

export const createAward = onRequest(WEN_FUNC.createAward)(
  awardCreateSchemaObject,
  createAwardControl,
);

export const addOwnerAward = onRequest(WEN_FUNC.addOwnerAward)(addOwnerSchema, addOwnerControl);

export const fundAward = onRequest(WEN_FUNC.fundAward)(awardFundSchema, fundAwardControl);

export const rejectAward = onRequest(WEN_FUNC.rejectAward)(awardRejectSchema, rejectAwardControl);

export const cancelAward = onRequest(WEN_FUNC.cancelAward)(awardCancelSchema, cancelAwardControl);

export const awardParticipate = onRequest(WEN_FUNC.participateAward)(
  awardParticipateSchema,
  awardParticipateControl,
);

export const approveAwardParticipant = onRequest(WEN_FUNC.approveParticipantAward, {
  timeoutSeconds: 540,
  memory: '4GiB',
})(approveAwardParticipantSchemaObject, approveAwardParticipantControl);
