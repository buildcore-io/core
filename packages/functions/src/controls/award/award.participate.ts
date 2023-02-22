import { Award, AwardParticipant, COL, SUB_COL, WenError } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { Database } from '../../database/Database';
import { throwInvalidArgument } from '../../utils/error.utils';

export const awardParticipateControl = async (owner: string, params: Record<string, unknown>) => {
  const award = await Database.getById<Award>(COL.AWARD, params.uid as string);
  if (!award) {
    throw throwInvalidArgument(WenError.award_does_not_exists);
  }

  if (award.rejected) {
    throw throwInvalidArgument(WenError.award_is_rejected);
  }

  if (!award.approved) {
    throw throwInvalidArgument(WenError.award_is_not_approved);
  }

  if (dayjs(award.endDate.toDate()).isBefore(dayjs())) {
    throw throwInvalidArgument(WenError.award_is_no_longer_available);
  }

  const awardParticipant = await Database.getById<AwardParticipant>(
    COL.AWARD,
    award.uid,
    SUB_COL.PARTICIPANTS,
    owner,
  );
  if (awardParticipant) {
    throw throwInvalidArgument(WenError.member_is_already_participant_of_space);
  }

  const participant = {
    uid: owner,
    comment: (params.comment as string) || null,
    parentId: award.uid,
    completed: false,
    parentCol: COL.AWARD,
  };
  await Database.create(COL.AWARD, participant, SUB_COL.PARTICIPANTS, award.uid);
  return participant;
};
