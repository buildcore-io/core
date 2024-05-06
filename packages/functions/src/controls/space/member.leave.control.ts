import { database } from '@buildcore/database';
import { COL, SUB_COL, SpaceLeaveRequest } from '@buildcore/interfaces';
import { getLeaveSpaceData } from '../../services/payment/tangle-service/space/SpaceLeaveService';
import { Context } from '../common';

export const leaveSpaceControl = async ({ owner, params }: Context<SpaceLeaveRequest>) => {
  const spaceUpdateData = await getLeaveSpaceData(owner, params.uid);

  const batch = database().batch();

  batch.delete(database().doc(COL.SPACE, params.uid, SUB_COL.MEMBERS, owner));
  batch.delete(database().doc(COL.SPACE, params.uid, SUB_COL.GUARDIANS, owner));
  batch.update(database().doc(COL.SPACE, params.uid), spaceUpdateData);

  const memberDocRef = database().doc(COL.MEMBER, owner);
  batch.update(memberDocRef, { spaces: { [params.uid]: { isMember: false } } });

  await batch.commit();

  return { status: 'success' };
};
