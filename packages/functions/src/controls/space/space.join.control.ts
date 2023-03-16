import { COL, Space, SUB_COL, WenError } from '@soonaverse/interfaces';
import admin from '../../admin.config';
import { getJoinSpaceData } from '../../services/payment/tangle-service/space/SpaceJoinService';
import { cOn, uOn } from '../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../utils/error.utils';

export const joinSpaceControl = async (owner: string, params: Record<string, unknown>) => {
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.uid}`);
  const space = <Space | undefined>(await spaceDocRef.get()).data();
  if (!space) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }
  const { space: spaceUpdateData, spaceMember, member } = await getJoinSpaceData(owner, space);

  const batch = admin.firestore().batch();

  const joiningMemberDocRef = spaceDocRef
    .collection(space.open || space.tokenBased ? SUB_COL.MEMBERS : SUB_COL.KNOCKING_MEMBERS)
    .doc(owner);

  batch.set(joiningMemberDocRef, cOn(spaceMember));
  batch.update(spaceDocRef, uOn(spaceUpdateData));
  const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${owner}`);
  batch.set(memberDocRef, member, { merge: true });

  await batch.commit();
  return spaceMember;
};
