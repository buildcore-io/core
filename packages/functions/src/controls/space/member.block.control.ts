import { COL, SpaceMember, SpaceMemberUpsertRequest, SUB_COL } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { getBlockMemberUpdateData } from '../../services/payment/tangle-service/space/SpaceBlockMemberService';

export const blockMemberControl = async (owner: string, params: SpaceMemberUpsertRequest) => {
  const member = params.member;
  const { space, blockedMember } = await getBlockMemberUpdateData(owner, params.uid, member);

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
  const blockedMemberDocRef = spaceDocRef.collection(SUB_COL.BLOCKED_MEMBERS).doc(member);

  const batch = build5Db().batch();
  batch.set(blockedMemberDocRef, blockedMember);
  batch.delete(spaceDocRef.collection(SUB_COL.MEMBERS).doc(member));
  batch.delete(spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).doc(member));
  batch.update(spaceDocRef, space);
  await batch.commit();

  return await blockedMemberDocRef.get<SpaceMember>();
};
