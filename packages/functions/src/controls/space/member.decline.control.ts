import { database } from '@buildcore/database';
import { COL, SUB_COL, SpaceMemberUpsertRequest } from '@buildcore/interfaces';
import { assertIsGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const declineMemberControl = async ({
  owner,
  params,
}: Context<SpaceMemberUpsertRequest>) => {
  await assertIsGuardian(params.uid, owner);

  const knockingMemberDocRef = database().doc(
    COL.SPACE,
    params.uid,
    SUB_COL.KNOCKING_MEMBERS,
    params.member,
  );

  const knockingMemberDoc = await knockingMemberDocRef.get();

  const batch = database().batch();
  batch.delete(knockingMemberDocRef);
  batch.update(database().doc(COL.SPACE, params.uid), {
    totalPendingMembers: database().inc(knockingMemberDoc ? -1 : 0),
  });
  await batch.commit();

  return { status: 'success' };
};
