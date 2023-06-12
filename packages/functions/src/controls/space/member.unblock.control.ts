import { COL, SUB_COL } from '@build5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { assertIsGuardian } from '../../utils/token.utils';

export const unblockMemberControl = async (owner: string, params: Record<string, unknown>) => {
  await assertIsGuardian(params.uid as string, owner);

  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${params.uid}`);
  const blockedMemberDocRef = spaceDocRef
    .collection(SUB_COL.BLOCKED_MEMBERS)
    .doc(params.member as string);
  await blockedMemberDocRef.delete();

  return { status: 'success' };
};
