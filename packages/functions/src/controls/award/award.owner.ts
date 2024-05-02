import { database } from '@buildcore/database';
import { AwardAddOwnerRequest, AwardOwner, COL, SUB_COL, WenError } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const addOwnerControl = async ({
  owner,
  params,
  project,
}: Context<AwardAddOwnerRequest>): Promise<AwardOwner> => {
  const awardDocRef = database().doc(COL.AWARD, params.uid);
  const award = await awardDocRef.get();
  if (!award) {
    throw invalidArgument(WenError.award_does_not_exists);
  }

  const awardOwner = await database().doc(COL.AWARD, params.uid, SUB_COL.OWNERS, owner).get();
  if (!awardOwner) {
    throw invalidArgument(WenError.you_are_not_owner_of_the_award);
  }

  const awardMember = await database()
    .doc(COL.AWARD, params.uid, SUB_COL.OWNERS, params.member)
    .get();
  if (awardMember) {
    throw invalidArgument(WenError.member_is_already_owner_of_space);
  }

  const newOwner: AwardOwner = {
    project,
    uid: params.member,
    parentId: award.uid,
    parentCol: COL.AWARD,
    createdOn: dateToTimestamp(dayjs()),
  };
  await database().doc(COL.AWARD, params.uid, SUB_COL.OWNERS, params.member).create(newOwner);
  return newOwner;
};
