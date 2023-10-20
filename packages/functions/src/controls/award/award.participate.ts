import {
  Award,
  AwardParticipant,
  AwardParticpateRequest,
  COL,
  SUB_COL,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../firebase/firestore/build5Db';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const awardParticipateControl = async ({
  owner,
  params,
}: Context<AwardParticpateRequest>): Promise<AwardParticipant> => {
  const awardDocRef = build5Db().doc(`${COL.AWARD}/${params.uid}`);
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

  const participant: AwardParticipant = {
    uid: owner,
    comment: params.comment || null,
    parentId: award.uid,
    completed: false,
    parentCol: COL.AWARD,
    count: 0,
    tokenReward: 0,
    createdOn: dateToTimestamp(dayjs()),
  };
  await awardDocRef.collection(SUB_COL.PARTICIPANTS).doc(owner).create(participant);
  return participant;
};
