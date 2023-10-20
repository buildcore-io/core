import { Award, AwardRejectRequest, COL, WenError } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { invalidArgument } from '../../utils/error.utils';
import { assertIsGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const rejectAwardControl = async ({
  owner,
  params,
}: Context<AwardRejectRequest>): Promise<Award> => {
  const awardDocRef = build5Db().doc(`${COL.AWARD}/${params.uid}`);
  const award = await awardDocRef.get<Award>();
  if (!award) {
    throw invalidArgument(WenError.award_does_not_exists);
  }

  await assertIsGuardian(award.space, owner);

  if (award.approved) {
    throw invalidArgument(WenError.award_is_already_approved);
  }

  if (award.rejected) {
    throw invalidArgument(WenError.award_is_already_rejected);
  }

  const updateData = { uid: award.uid, rejected: true, rejectedBy: owner };
  await awardDocRef.update(updateData);

  return { ...award, ...updateData };
};
