import { build5Db } from '@build-5/database';
import { COL, SUB_COL, SpaceLeaveRequest } from '@build-5/interfaces';
import { Context } from '../../runtime/firebase/common';
import { getLeaveSpaceData } from '../../services/payment/tangle-service/space/SpaceLeaveService';

export const leaveSpaceControl = async ({ owner }: Context, params: SpaceLeaveRequest) => {
  const { space, member } = await getLeaveSpaceData(owner, params.uid);

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);

  const batch = build5Db().batch();

  batch.delete(spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner));
  batch.delete(spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner));
  batch.update(spaceDocRef, space);

  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  batch.set(memberDocRef, member, true);

  await batch.commit();

  return { status: 'success' };
};
