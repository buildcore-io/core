import { COL, SpaceMember, SUB_COL } from '@soonaverse/interfaces';
import admin from '../../admin.config';
import { acceptSpaceMember } from '../../services/payment/tangle-service/space/SpaceAcceptMemberService';
import { cOn, uOn } from '../../utils/dateTime.utils';

export const acceptSpaceMemberControl = async (owner: string, params: Record<string, unknown>) => {
  const { spaceMember, space } = await acceptSpaceMember(
    owner,
    params.uid as string,
    params.member as string,
  );

  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.uid as string}`);
  const memberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(spaceMember.uid);
  const knockingMemberDocRef = spaceDocRef
    .collection(SUB_COL.KNOCKING_MEMBERS)
    .doc(spaceMember.uid);

  const batch = admin.firestore().batch();
  batch.set(memberDocRef, cOn(spaceMember));
  batch.delete(knockingMemberDocRef);
  batch.update(spaceDocRef, uOn(space));
  await batch.commit();

  return <SpaceMember>(await memberDocRef.get()).data();
};
