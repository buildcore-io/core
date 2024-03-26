import { build5Db } from '@build-5/database';
import { COL, SpaceMemberUpsertRequest, SUB_COL } from '@build-5/interfaces';
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

  const blockedMemberDocRef = build5Db().doc(
    COL.SPACE,
    params.uid,
    SUB_COL.BLOCKED_MEMBERS,
    member,
  );

  const batch = build5Db().batch();
  batch.upsert(blockedMemberDocRef, {
    ...blockedMember,
    createdOn: blockedMember.createdOn.toDate(),
  });
  batch.delete(build5Db().doc(COL.SPACE, params.uid, SUB_COL.MEMBERS, member));
  batch.delete(build5Db().doc(COL.SPACE, params.uid, SUB_COL.KNOCKING_MEMBERS, member));
  batch.update(build5Db().doc(COL.SPACE, params.uid), space);
  await batch.commit();

  return await blockedMemberDocRef.get();
};
