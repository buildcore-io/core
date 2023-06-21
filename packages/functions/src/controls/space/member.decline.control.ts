import { COL, SUB_COL, SpaceMemberUpsertRequest } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { assertIsGuardian } from '../../utils/token.utils';

export const declineMemberControl = async (owner: string, params: SpaceMemberUpsertRequest) => {
  await assertIsGuardian(params.uid, owner);

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
  const knockingMemberDocRef = spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).doc(params.member);

  const knockingMemberDoc = await knockingMemberDocRef.get();

  const batch = build5Db().batch();
  batch.delete(knockingMemberDocRef);
  batch.update(spaceDocRef, { totalPendingMembers: build5Db().inc(knockingMemberDoc ? -1 : 0) });
  await batch.commit();

  return { status: 'success' };
};
