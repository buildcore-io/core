import { COL, SUB_COL, SpaceMemberUpsertRequest } from '@build-5/interfaces';
import { Context } from '../../runtime/firebase/common';
import { assertIsGuardian } from '../../utils/token.utils';
import { build5Db } from '@build-5/database';

export const unblockMemberControl = async (
  { owner }: Context,
  params: SpaceMemberUpsertRequest,
) => {
  await assertIsGuardian(params.uid, owner);

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
  const blockedMemberDocRef = spaceDocRef.collection(SUB_COL.BLOCKED_MEMBERS).doc(params.member);
  await blockedMemberDocRef.delete();

  return { status: 'success' };
};
