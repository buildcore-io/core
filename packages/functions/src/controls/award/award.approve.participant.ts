import { build5Db } from '@build-5/database';
import {
  ApiError,
  AwardApproveParticipantRequest,
  AwardApproveParticipantResponse,
  Transaction,
} from '@build-5/interfaces';
import { get } from 'lodash';
import { Context } from '../../runtime/firebase/common';
import { approveAwardParticipant } from '../../services/payment/tangle-service/award/award.approve.participant.service';

export const approveAwardParticipantControl = async (
  { project, owner }: Context,
  params: AwardApproveParticipantRequest,
): Promise<AwardApproveParticipantResponse> => {
  const members = params.members.map((m) => m.toLowerCase());
  const awardId = params.award;
  const badges: { [key: string]: Transaction } = {};
  const errors: { [key: string]: ApiError } = {};

  for (const member of members) {
    try {
      const badge = await build5Db().runTransaction(
        approveAwardParticipant(project, owner, awardId, member),
      );
      badges[badge.uid] = badge;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      errors[member] = {
        code: get<number>(error, 'details.code', 0),
        message: get<string>(error, 'details.key', ''),
      };
    }
  }
  return { badges, errors };
};
