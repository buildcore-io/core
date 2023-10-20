import { COL, SUB_COL, SpaceMemberUpsertRequest } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { assertIsGuardian } from '../../utils/token.utils';
import { Context } from '../common';

export const unblockMemberControl = async ({
  owner,
  params,
}: Context<SpaceMemberUpsertRequest>) => {
  await assertIsGuardian(params.uid, owner);

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
  const blockedMemberDocRef = spaceDocRef.collection(SUB_COL.BLOCKED_MEMBERS).doc(params.member);
  await blockedMemberDocRef.delete();

  return { status: 'success' };
};
