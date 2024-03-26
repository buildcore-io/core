import { build5Db } from '@build-5/database';
import { COL, SUB_COL, SpaceLeaveRequest } from '@build-5/interfaces';
import { getLeaveSpaceData } from '../../services/payment/tangle-service/space/SpaceLeaveService';
import { Context } from '../common';

export const leaveSpaceControl = async ({ owner, params }: Context<SpaceLeaveRequest>) => {
  const spaceUpdateData = await getLeaveSpaceData(owner, params.uid);

  const batch = build5Db().batch();

  batch.delete(build5Db().doc(COL.SPACE, params.uid, SUB_COL.MEMBERS, owner));
  batch.delete(build5Db().doc(COL.SPACE, params.uid, SUB_COL.GUARDIANS, owner));
  batch.update(build5Db().doc(COL.SPACE, params.uid), spaceUpdateData);

  const memberDocRef = build5Db().doc(COL.MEMBER, owner);
  batch.update(memberDocRef, { spaces: { [params.uid]: { isMember: false } } });

  await batch.commit();

  return { status: 'success' };
};
