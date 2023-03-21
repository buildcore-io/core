import { COL, SpaceMember, SUB_COL } from '@soonaverse/interfaces';
import { soonDb } from '../../database/wrapper/soondb';
import { getBlockMemberUpdateData } from '../../services/payment/tangle-service/space/SpaceBlockMemberService';

export const blockMemberControl = async (owner: string, params: Record<string, unknown>) => {
  const member = params.member as string;
  const { space, blockedMember } = await getBlockMemberUpdateData(
    owner,
    params.uid as string,
    member,
  );

  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${params.uid}`);
  const blockedMemberDocRef = spaceDocRef.collection(SUB_COL.BLOCKED_MEMBERS).doc(member);

  const batch = soonDb().batch();
  batch.set(blockedMemberDocRef, blockedMember);
  batch.delete(spaceDocRef.collection(SUB_COL.MEMBERS).doc(member));
  batch.delete(spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).doc(member));
  batch.delete(spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member));
  batch.update(spaceDocRef, space);
  await batch.commit();

  return await blockedMemberDocRef.get<SpaceMember>();
};
