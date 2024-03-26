import { build5Db } from '@build-5/database';
import { COL, SUB_COL, SpaceMemberUpsertRequest } from '@build-5/interfaces';
import { assertIsGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const unblockMemberControl = async ({
  owner,
  params,
}: Context<SpaceMemberUpsertRequest>) => {
  await assertIsGuardian(params.uid, owner);

  const blockedMemberDocRef = build5Db().doc(
    COL.SPACE,
    params.uid,
    SUB_COL.BLOCKED_MEMBERS,
    params.member,
  );
  await blockedMemberDocRef.delete();

  return { status: 'success' };
};
