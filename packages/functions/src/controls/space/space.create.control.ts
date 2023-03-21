import { COL, SUB_COL } from '@soonaverse/interfaces';
import { soonDb } from '../../database/wrapper/soondb';
import { getCreateSpaceData } from '../../services/payment/tangle-service/space/SpaceCreateService';

export const createSpaceControl = async (owner: string, params: Record<string, unknown>) => {
  const { space, guardian, member } = await getCreateSpaceData(owner, params);

  const batch = soonDb().batch();

  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${space.uid}`);
  batch.create(spaceDocRef, space);

  const spaceGuardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner);
  batch.create(spaceGuardianDocRef, guardian);
  const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner);
  batch.create(spaceMemberDocRef, guardian);

  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${owner}`);
  batch.set(memberDocRef, member, true);

  await batch.commit();

  return soonDb().doc(`${COL.SPACE}/${space.uid}`).get();
};
