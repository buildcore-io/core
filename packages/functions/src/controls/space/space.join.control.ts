import { COL, Space, SUB_COL, WenError } from '@build-5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { getJoinSpaceData } from '../../services/payment/tangle-service/space/SpaceJoinService';
import { invalidArgument } from '../../utils/error.utils';

export const joinSpaceControl = async (owner: string, params: Record<string, unknown>) => {
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${params.uid}`);
  const space = await spaceDocRef.get<Space>();
  if (!space) {
    throw invalidArgument(WenError.space_does_not_exists);
  }
  const { space: spaceUpdateData, spaceMember, member } = await getJoinSpaceData(owner, space);

  const batch = soonDb().batch();

  const joiningMemberDocRef = spaceDocRef
    .collection(space.open || space.tokenBased ? SUB_COL.MEMBERS : SUB_COL.KNOCKING_MEMBERS)
    .doc(owner);

  batch.set(joiningMemberDocRef, spaceMember);
  batch.update(spaceDocRef, spaceUpdateData);
  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${owner}`);
  batch.set(memberDocRef, member, true);

  await batch.commit();
  return spaceMember;
};
