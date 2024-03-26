import { build5Db } from '@build-5/database';
import { COL, SUB_COL, Space, SpaceCreateRequest } from '@build-5/interfaces';
import { getCreateSpaceData } from '../../services/payment/tangle-service/space/SpaceCreateService';
import { Context } from '../common';

export const createSpaceControl = async ({
  owner,
  params,
  project,
}: Context<SpaceCreateRequest>): Promise<Space> => {
  const { space, guardian } = await getCreateSpaceData(project, owner, { ...params });

  const batch = build5Db().batch();

  const spaceDocRef = build5Db().doc(COL.SPACE, space.uid);
  batch.create(spaceDocRef, space);

  const spaceGuardianDocRef = build5Db().doc(COL.SPACE, space.uid, SUB_COL.GUARDIANS, owner);
  batch.create(spaceGuardianDocRef, guardian);
  const spaceMemberDocRef = build5Db().doc(COL.SPACE, space.uid, SUB_COL.MEMBERS, owner);
  batch.create(spaceMemberDocRef, guardian);

  const memberDocRef = build5Db().doc(COL.MEMBER, owner);
  batch.update(memberDocRef, { spaces: { [space.uid]: { uid: space.uid, isMember: true } } });

  await batch.commit();

  return (await spaceDocRef.get())!;
};
