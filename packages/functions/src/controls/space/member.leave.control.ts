import { COL, SUB_COL } from '@build-5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { getLeaveSpaceData } from '../../services/payment/tangle-service/space/SpaceLeaveService';

export const leaveSpaceControl = async (owner: string, params: Record<string, unknown>) => {
  const { space, member } = await getLeaveSpaceData(owner, params.uid as string);

  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${params.uid}`);

  const batch = soonDb().batch();

  batch.delete(spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner));
  batch.delete(spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner));
  batch.update(spaceDocRef, space);

  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${owner}`);
  batch.set(memberDocRef, member, true);

  await batch.commit();

  return { status: 'success' };
};
