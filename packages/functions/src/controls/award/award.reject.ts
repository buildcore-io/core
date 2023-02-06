import { Award, COL, WenError } from '@soonaverse/interfaces';
import { Database } from '../../database/Database';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const rejectAwardControl = async (owner: string, params: Record<string, unknown>) => {
  const award = await Database.getById<Award>(COL.AWARD, params.uid as string);
  if (!award) {
    throw throwInvalidArgument(WenError.award_does_not_exists);
  }

  await assertIsGuardian(award.space, owner);

  if (award.approved) {
    throw throwInvalidArgument(WenError.award_is_already_approved);
  }

  if (award.rejected) {
    throw throwInvalidArgument(WenError.award_is_already_rejected);
  }

  const updateData = { uid: award.uid, rejected: true, rejectedBy: owner };
  await Database.update(COL.AWARD, updateData);
  return { ...award, ...updateData };
};