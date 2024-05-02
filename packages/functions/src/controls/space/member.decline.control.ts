import { build5Db } from '@build-5/database';
import { COL, SUB_COL, SpaceMemberUpsertRequest } from '@build-5/interfaces';
import { assertIsGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const declineMemberControl = async ({
  owner,
  params,
}: Context<SpaceMemberUpsertRequest>) => {
  await assertIsGuardian(params.uid, owner);

  const knockingMemberDocRef = build5Db().doc(
    COL.SPACE,
    params.uid,
    SUB_COL.KNOCKING_MEMBERS,
    params.member,
  );

  const knockingMemberDoc = await knockingMemberDocRef.get();

  const batch = build5Db().batch();
  batch.delete(knockingMemberDocRef);
  batch.update(build5Db().doc(COL.SPACE, params.uid), {
    totalPendingMembers: build5Db().inc(knockingMemberDoc ? -1 : 0),
  });
  await batch.commit();

  return { status: 'success' };
};
