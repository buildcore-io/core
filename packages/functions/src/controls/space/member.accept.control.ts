import { database } from '@buildcore/database';
import { COL, SpaceMemberUpsertRequest, SUB_COL } from '@buildcore/interfaces';
import { acceptSpaceMember } from '../../services/payment/tangle-service/space/SpaceAcceptMemberService';
import { Context } from '../common';

export const acceptSpaceMemberControl = async ({
  owner,
  params,
  project,
}: Context<SpaceMemberUpsertRequest>) => {
  const { spaceMember, space } = await acceptSpaceMember(project, owner, params.uid, params.member);

  const memberDocRef = database().doc(COL.SPACE, params.uid, SUB_COL.MEMBERS, spaceMember.uid);
  const knockingMemberDocRef = database().doc(
    COL.SPACE,
    params.uid,
    SUB_COL.KNOCKING_MEMBERS,
    spaceMember.uid,
  );

  const batch = database().batch();
  batch.upsert(memberDocRef, { ...spaceMember, createdOn: spaceMember.createdOn.toDate() });
  batch.delete(knockingMemberDocRef);
  batch.update(database().doc(COL.SPACE, params.uid), space);
  await batch.commit();

  return await memberDocRef.get();
};
