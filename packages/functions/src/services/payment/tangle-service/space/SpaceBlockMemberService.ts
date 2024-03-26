import { build5Db } from '@build-5/database';
import { COL, Space, SUB_COL, TangleResponse, WenError } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { getProject } from '../../../../utils/common.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { editSpaceMemberSchemaObject } from './SpaceEditMemberTangleRequestSchema';

export class SpaceBlockMemberService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({ order, owner, request }: HandlerParams) => {
    const params = await assertValidationAsync(editSpaceMemberSchemaObject, request);

    const member = params.member;
    const { space, blockedMember } = await getBlockMemberUpdateData(
      getProject(order),
      owner,
      params.uid,
      member,
    );

    const spaceDocRef = build5Db().doc(COL.SPACE, params.uid);
    const blockedMemberDocRef = build5Db().doc(
      COL.SPACE,
      params.uid,
      SUB_COL.BLOCKED_MEMBERS,
      member,
    );

    this.transactionService.push({
      ref: blockedMemberDocRef,
      data: blockedMember,
      action: Action.C,
    });

    this.transactionService.push({
      ref: build5Db().doc(COL.SPACE, params.uid, SUB_COL.MEMBERS, member),
      data: undefined,
      action: Action.D,
    });

    this.transactionService.push({
      ref: build5Db().doc(COL.SPACE, params.uid, SUB_COL.KNOCKING_MEMBERS, member),
      data: undefined,
      action: Action.D,
    });

    this.transactionService.push({
      ref: spaceDocRef,
      data: space,
      action: Action.U,
    });

    return { status: 'success' };
  };
}

export const getBlockMemberUpdateData = async (
  project: string,
  owner: string,
  spaceId: string,
  member: string,
) => {
  const spaceDocRef = build5Db().doc(COL.SPACE, spaceId);
  await assertIsGuardian(spaceId, owner);

  const spaceMember = await build5Db().doc(COL.SPACE, spaceId, SUB_COL.MEMBERS, member).get();
  const knockingMember = await build5Db()
    .doc(COL.SPACE, spaceId, SUB_COL.KNOCKING_MEMBERS, member)
    .get();
  if (!spaceMember && !knockingMember) {
    throw invalidArgument(WenError.member_is_not_part_of_the_space);
  }

  const blockedMemberDocRef = build5Db().doc(COL.SPACE, spaceId, SUB_COL.BLOCKED_MEMBERS, member);
  const blockedMemberDoc = await blockedMemberDocRef.get();
  if (blockedMemberDoc) {
    throw invalidArgument(WenError.member_is_already_blocked);
  }

  const space = <Space>await spaceDocRef.get();
  if (space.totalMembers === 1) {
    throw invalidArgument(WenError.at_least_one_member_must_be_in_the_space);
  }

  const guardian = await build5Db().doc(COL.SPACE, spaceId, SUB_COL.GUARDIANS, member).get();
  if (guardian) {
    throw invalidArgument(WenError.can_not_block_guardian);
  }

  const blockedMember = {
    project,
    uid: member,
    parentId: spaceId,
    parentCol: COL.SPACE,
    createdOn: dateToTimestamp(dayjs()),
  };
  const spaceUpdateData = {
    totalMembers: build5Db().inc(spaceMember ? -1 : 0),
    totalPendingMembers: build5Db().inc(knockingMember ? -1 : 0),
  };
  return { blockedMember, space: spaceUpdateData };
};
