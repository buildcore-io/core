import { COL, SpaceMember, SUB_COL } from '@build-5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { acceptSpaceMember } from '../../services/payment/tangle-service/space/SpaceAcceptMemberService';

export const acceptSpaceMemberControl = async (owner: string, params: Record<string, unknown>) => {
  const { spaceMember, space } = await acceptSpaceMember(
    owner,
    params.uid as string,
    params.member as string,
  );

  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${params.uid as string}`);
  const memberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(spaceMember.uid);
  const knockingMemberDocRef = spaceDocRef
    .collection(SUB_COL.KNOCKING_MEMBERS)
    .doc(spaceMember.uid);

  const batch = soonDb().batch();
  batch.set(memberDocRef, spaceMember);
  batch.delete(knockingMemberDocRef);
  batch.update(spaceDocRef, space);
  await batch.commit();

  return await memberDocRef.get<SpaceMember>();
};
