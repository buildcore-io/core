import { build5Db } from '@build-5/database';
import { COL, Space, SpaceJoinRequest, SUB_COL, WenError } from '@build-5/interfaces';
import { getJoinSpaceData } from '../../services/payment/tangle-service/space/SpaceJoinService';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const joinSpaceControl = async ({ owner, params }: Context<SpaceJoinRequest>) => {
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
  const space = await spaceDocRef.get<Space>();
  if (!space) {
    throw invalidArgument(WenError.space_does_not_exists);
  }
  const { space: spaceUpdateData, spaceMember, member } = await getJoinSpaceData(owner, space);

  const batch = build5Db().batch();

  const joiningMemberDocRef = spaceDocRef
    .collection(space.open || space.tokenBased ? SUB_COL.MEMBERS : SUB_COL.KNOCKING_MEMBERS)
    .doc(owner);

  batch.set(joiningMemberDocRef, spaceMember);
  batch.update(spaceDocRef, spaceUpdateData);
  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  batch.set(memberDocRef, member, true);

  await batch.commit();
  return spaceMember;
};
