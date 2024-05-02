import { database } from '@buildcore/database';
import { COL, SUB_COL, Space, SpaceCreateRequest } from '@buildcore/interfaces';
import { getCreateSpaceData } from '../../services/payment/tangle-service/space/SpaceCreateService';
import { Context } from '../common';

export const createSpaceControl = async ({
  owner,
  params,
  project,
}: Context<SpaceCreateRequest>): Promise<Space> => {
  const { space, guardian } = await getCreateSpaceData(project, owner, { ...params });

  const batch = database().batch();

  const spaceDocRef = database().doc(COL.SPACE, space.uid);
  batch.create(spaceDocRef, space);

  const spaceGuardianDocRef = database().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, owner);
  batch.create(spaceGuardianDocRef, guardian);
  const spaceMemberDocRef = database().doc(COL.SPACE, space.uid, SUB_COL.MEMBERS, owner);
  batch.create(spaceMemberDocRef, guardian);

  const memberDocRef = database().doc(COL.MEMBER, owner);
  batch.update(memberDocRef, { spaces: { [space.uid]: { uid: space.uid, isMember: true } } });

  await batch.commit();

  return (await spaceDocRef.get())!;
};
