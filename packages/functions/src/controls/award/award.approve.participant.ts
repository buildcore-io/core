import { Transaction } from '@soonaverse/interfaces';
import { get } from 'lodash';
import { soonDb } from '../../database/wrapper/soondb';
import { approveAwardParticipant } from '../../services/payment/tangle-service/award/award.approve.participant.service';

export const approveAwardParticipantControl = async (
  owner: string,
  params: Record<string, unknown>,
) => {
  const members = params.members as string[];
  const awardId = params.award as string;
  const badges: { [key: string]: Transaction } = {};
  const errors: { [key: string]: unknown } = {};

  for (const member of members) {
    try {
      const badge = await soonDb().runTransaction(approveAwardParticipant(owner, awardId, member));
      badges[badge.uid] = badge;
    } catch (error) {
      errors[member] = {
        code: get(error, 'details.code', ''),
        message: get(error, 'details.key', ''),
      };
    }
  }
  return { badges, errors };
};
