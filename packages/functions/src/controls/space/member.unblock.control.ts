import { database } from '@buildcore/database';
import { COL, SUB_COL, SpaceMemberUpsertRequest } from '@buildcore/interfaces';
import { assertIsGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const unblockMemberControl = async ({
  owner,
  params,
}: Context<SpaceMemberUpsertRequest>) => {
  await assertIsGuardian(params.uid, owner);

  const blockedMemberDocRef = database().doc(
    COL.SPACE,
    params.uid,
    SUB_COL.BLOCKED_MEMBERS,
    params.member,
  );
  await blockedMemberDocRef.delete();

  return { status: 'success' };
};
