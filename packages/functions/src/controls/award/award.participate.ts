import { Award, COL, SUB_COL, WenError } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../firebase/firestore/soondb';
import { invalidArgument } from '../../utils/error.utils';

export const awardParticipateControl = async (owner: string, params: Record<string, unknown>) => {
  const awardDocRef = soonDb().doc(`${COL.AWARD}/${params.uid}`);
  const award = await awardDocRef.get<Award>();
  if (!award) {
    throw invalidArgument(WenError.award_does_not_exists);
  }

  if (award.rejected) {
    throw invalidArgument(WenError.award_is_rejected);
  }

  if (!award.approved) {
    throw invalidArgument(WenError.award_is_not_approved);
  }

  if (dayjs(award.endDate.toDate()).isBefore(dayjs())) {
    throw invalidArgument(WenError.award_is_no_longer_available);
  }

  const awardParticipant = await awardDocRef.collection(SUB_COL.PARTICIPANTS).doc(owner).get();
  if (awardParticipant) {
    throw invalidArgument(WenError.member_is_already_participant_of_space);
  }

  const participant = {
    uid: owner,
    comment: (params.comment as string) || null,
    parentId: award.uid,
    completed: false,
    parentCol: COL.AWARD,
  };
  await awardDocRef.collection(SUB_COL.PARTICIPANTS).doc(owner).create(participant);
  return participant;
};
