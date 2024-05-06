import { database } from '@buildcore/database';
import { COL, SpaceMemberUpsertRequest, SUB_COL } from '@buildcore/interfaces';
import { getBlockMemberUpdateData } from '../../services/payment/tangle-service/space/SpaceBlockMemberService';
import { Context } from '../common';

export const blockMemberControl = async ({
  owner,
  params,
  project,
}: Context<SpaceMemberUpsertRequest>) => {
  const member = params.member;
  const { space, blockedMember } = await getBlockMemberUpdateData(
    project,
    owner,
    params.uid,
    member,
  );

  const blockedMemberDocRef = database().doc(
    COL.SPACE,
    params.uid,
    SUB_COL.BLOCKED_MEMBERS,
    member,
  );

  const batch = database().batch();
  batch.upsert(blockedMemberDocRef, {
    ...blockedMember,
    createdOn: blockedMember.createdOn.toDate(),
  });
  batch.delete(database().doc(COL.SPACE, params.uid, SUB_COL.MEMBERS, member));
  batch.delete(database().doc(COL.SPACE, params.uid, SUB_COL.KNOCKING_MEMBERS, member));
  batch.update(database().doc(COL.SPACE, params.uid), space);
  await batch.commit();

  return await blockedMemberDocRef.get();
};
