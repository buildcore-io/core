import { COL, SpaceMember, SUB_COL } from '@soonaverse/interfaces';
import admin from '../../admin.config';
import { getBlockMemberUpdateData } from '../../services/payment/tangle-service/space/SpaceBlockMemberService';
import { cOn, uOn } from '../../utils/dateTime.utils';

export const blockMemberControl = async (owner: string, params: Record<string, unknown>) => {
  const member = params.member as string;
  const { space, blockedMember } = await getBlockMemberUpdateData(
    owner,
    params.uid as string,
    member,
  );

  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.uid}`);
  const blockedMemberDocRef = spaceDocRef.collection(SUB_COL.BLOCKED_MEMBERS).doc(member);

  const batch = admin.firestore().batch();
  batch.set(blockedMemberDocRef, cOn(blockedMember));
  batch.delete(spaceDocRef.collection(SUB_COL.MEMBERS).doc(member));
  batch.delete(spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).doc(member));
  batch.delete(spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member));
  batch.update(spaceDocRef, uOn(space));
  await batch.commit();

  return <SpaceMember>(await blockedMemberDocRef.get()).data();
};
