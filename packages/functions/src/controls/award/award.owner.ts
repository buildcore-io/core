import { build5Db } from '@build-5/database';
import {
  Award,
  AwardAddOwnerRequest,
  AwardOwner,
  COL,
  SUB_COL,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { Context } from '../../runtime/firebase/common';
import { getProjects } from '../../utils/common.utils';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';

export const addOwnerControl = async (
  { project, owner }: Context,
  params: AwardAddOwnerRequest,
): Promise<AwardOwner> => {
  const awardDocRef = build5Db().doc(`${COL.AWARD}/${params.uid}`);
  const award = await awardDocRef.get<Award>();
  if (!award) {
    throw invalidArgument(WenError.award_does_not_exists);
  }

  const awardOwner = await awardDocRef.collection(SUB_COL.OWNERS).doc(owner).get();
  if (!awardOwner) {
    throw invalidArgument(WenError.you_are_not_owner_of_the_award);
  }

  const awardMember = await awardDocRef.collection(SUB_COL.OWNERS).doc(params.member).get();
  if (awardMember) {
    throw invalidArgument(WenError.member_is_already_owner_of_space);
  }

  const newOwner: AwardOwner = {
    project,
    projects: getProjects([award], project),
    uid: params.member,
    parentId: award.uid,
    parentCol: COL.AWARD,
    createdOn: dateToTimestamp(dayjs()),
  };
  await awardDocRef.collection(SUB_COL.OWNERS).doc(params.member).create(newOwner);
  return newOwner;
};
