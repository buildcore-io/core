import { Award, COL, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { throwInvalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';

export const rejectAwardControl = async (owner: string, params: Record<string, unknown>) => {
  const awardDocRef = soonDb().doc(`${COL.AWARD}/${params.uid}`);
  const award = await awardDocRef.get<Award>();
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
  await awardDocRef.update(updateData);

  return { ...award, ...updateData };
};
