import { Award, COL, WenError } from '@soonaverse/interfaces';
import { Database } from '../../database/Database';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const approveAwardControl = async (owner: string, params: Record<string, unknown>) => {
  const award = await Database.getById<Award>(COL.AWARD, params.uid as string);
  if (!award) {
    throw throwInvalidArgument(WenError.award_does_not_exists);
  }

  await assertIsGuardian(award.space, owner);

  if (award.approved) {
    throw throwInvalidArgument(WenError.award_is_already_approved);
  }

  const updateData = { uid: award.uid, approved: true, approvedBy: owner };
  await Database.update(COL.AWARD, updateData);
  return { ...award, ...updateData };
};
