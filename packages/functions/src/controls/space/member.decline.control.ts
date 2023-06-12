import { COL, SUB_COL } from '@build-5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { assertIsGuardian } from '../../utils/token.utils';

export const declineMemberControl = async (owner: string, params: Record<string, unknown>) => {
  await assertIsGuardian(params.uid as string, owner);

  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${params.uid}`);
  const knockingMemberDocRef = spaceDocRef
    .collection(SUB_COL.KNOCKING_MEMBERS)
    .doc(params.member as string);

  const knockingMemberDoc = await knockingMemberDocRef.get();

  const batch = soonDb().batch();
  batch.delete(knockingMemberDocRef);
  batch.update(spaceDocRef, { totalPendingMembers: soonDb().inc(knockingMemberDoc ? -1 : 0) });
  await batch.commit();

  return { status: 'success' };
};
