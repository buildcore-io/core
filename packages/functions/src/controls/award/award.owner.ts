import { Award, COL, SUB_COL, WenError } from '@soonaverse/interfaces';
import { Database } from '../../database/Database';
import { throwInvalidArgument } from '../../utils/error.utils';

export const addOwnerControl = async (owner: string, params: Record<string, unknown>) => {
  const award = await Database.getById<Award>(COL.AWARD, params.uid as string);
  if (!award) {
    throw throwInvalidArgument(WenError.award_does_not_exists);
  }

  const awardOwner = await Database.getById(COL.AWARD, award.uid, SUB_COL.OWNERS, owner);
  if (!awardOwner) {
    throw throwInvalidArgument(WenError.you_are_not_owner_of_the_award);
  }

  const awardMember = await Database.getById(
    COL.AWARD,
    award.uid,
    SUB_COL.OWNERS,
    params.member as string,
  );
  if (awardMember) {
    throw throwInvalidArgument(WenError.member_is_already_owner_of_space);
  }

  const newOwner = { uid: params.member as string, parentId: award.uid, parentCol: COL.AWARD };
  await Database.create(COL.AWARD, newOwner, SUB_COL.OWNERS, award.uid);
  return newOwner;
};
