import { COL, SUB_COL, URL_PATHS } from '@soonaverse/interfaces';
import admin from '../../admin.config';
import { getCreateSpaceData } from '../../services/payment/tangle-service/space/SpaceCreateService';
import { cOn, uOn } from '../../utils/dateTime.utils';

export const createSpaceControl = async (owner: string, params: Record<string, unknown>) => {
  const { space, guardian, member } = await getCreateSpaceData(owner, params);

  const batch = admin.firestore().batch();

  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${space.uid}`);
  batch.create(spaceDocRef, cOn(space, URL_PATHS.SPACE));

  const spaceGuardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner);
  batch.create(spaceGuardianDocRef, cOn(guardian));
  const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner);
  batch.create(spaceMemberDocRef, cOn(guardian));

  const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${owner}`);
  batch.set(memberDocRef, uOn(member), { merge: true });

  await batch.commit();

  return space;
};
