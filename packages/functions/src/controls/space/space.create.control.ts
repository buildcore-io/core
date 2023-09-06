import { build5Db } from '@build-5/database';
import { COL, SUB_COL, Space, SpaceCreateRequest } from '@build-5/interfaces';
import { getCreateSpaceData } from '../../services/payment/tangle-service/space/SpaceCreateService';

export const createSpaceControl = async (
  owner: string,
  params: SpaceCreateRequest,
): Promise<Space> => {
  const { space, guardian, member } = await getCreateSpaceData(owner, { ...params });

  const batch = build5Db().batch();

  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space.uid}`);
  batch.create(spaceDocRef, space);

  const spaceGuardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner);
  batch.create(spaceGuardianDocRef, guardian);
  const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner);
  batch.create(spaceMemberDocRef, guardian);

  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
  batch.set(memberDocRef, member, true);

  await batch.commit();

  return (await spaceDocRef.get<Space>())!;
};
