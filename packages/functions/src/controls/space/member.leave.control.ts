import { COL, SUB_COL } from '@soonaverse/interfaces';
import admin from '../../admin.config';
import { getLeaveSpaceData } from '../../services/payment/tangle-service/space/SpaceLeaveService';
import { uOn } from '../../utils/dateTime.utils';

export const leaveSpaceControl = async (owner: string, params: Record<string, unknown>) => {
  const { space, member } = await getLeaveSpaceData(owner, params.uid as string);

  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${params.uid}`);

  const batch = admin.firestore().batch();

  batch.delete(spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner));
  batch.delete(spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner));
  batch.update(spaceDocRef, uOn(space));

  const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${owner}`);
  batch.set(memberDocRef, uOn(member), { merge: true });

  await batch.commit();

  return { status: 'success' };
};
