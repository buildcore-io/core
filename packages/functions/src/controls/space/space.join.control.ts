import { build5Db } from '@build-5/database';
import { COL, SpaceJoinRequest, SUB_COL, WenError } from '@build-5/interfaces';
import { getJoinSpaceData } from '../../services/payment/tangle-service/space/SpaceJoinService';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const joinSpaceControl = async ({ owner, params, project }: Context<SpaceJoinRequest>) => {
  const spaceDocRef = build5Db().doc(COL.SPACE, params.uid);
  const space = await spaceDocRef.get();
  if (!space) {
    throw invalidArgument(WenError.space_does_not_exists);
  }
  const { space: spaceUpdateData, spaceMember } = await getJoinSpaceData(project, owner, space);

  const batch = build5Db().batch();

  const subCol = space.open || space.tokenBased ? SUB_COL.MEMBERS : SUB_COL.KNOCKING_MEMBERS;
  const joiningMemberDocRef = build5Db().doc(COL.SPACE, params.uid, subCol, owner);

  batch.create(joiningMemberDocRef, spaceMember);
  batch.update(spaceDocRef, spaceUpdateData);

  const memberDocRef = build5Db().doc(COL.MEMBER, owner);
  batch.update(memberDocRef, { spaces: { [space.uid]: { uid: space.uid, isMember: true } } });

  await batch.commit();
  return spaceMember;
};
