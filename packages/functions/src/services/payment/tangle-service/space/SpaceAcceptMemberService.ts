import { build5Db } from '@build-5/database';
import { COL, SUB_COL, TangleResponse, WenError } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { getProject } from '../../../../utils/common.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { editSpaceMemberSchemaObject } from './SpaceEditMemberTangleRequestSchema';

export class SpaceAcceptMemberService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({ order, owner, request }: HandlerParams) => {
    const params = await assertValidationAsync(editSpaceMemberSchemaObject, request);

    const { spaceMember, space } = await acceptSpaceMember(
      getProject(order),
      owner,
      params.uid,
      params.member,
    );

    const spaceMemberDocRef = build5Db().doc(
      COL.SPACE,
      params.uid,
      SUB_COL.MEMBERS,
      spaceMember.uid,
    );
    const knockingMemberDocRef = build5Db().doc(
      COL.SPACE,
      params.uid,
      SUB_COL.KNOCKING_MEMBERS,
      spaceMember.uid,
    );

    this.transactionService.push({
      ref: spaceMemberDocRef,
      data: spaceMember,
      action: Action.C,
    });
    this.transactionService.push({ ref: knockingMemberDocRef, data: undefined, action: Action.D });
    this.transactionService.push({
      ref: build5Db().doc(COL.SPACE, params.uid),
      data: space,
      action: Action.U,
    });

    return { status: 'success' };
  };
}

export const acceptSpaceMember = async (
  project: string,
  owner: string,
  spaceId: string,
  member: string,
) => {
  await assertIsGuardian(spaceId, owner);

  const spaceDocRef = build5Db().doc(COL.SPACE, spaceId);
  const knockingMember = await build5Db()
    .doc(COL.SPACE, spaceId, SUB_COL.KNOCKING_MEMBERS, member)
    .get();
  if (!knockingMember) {
    throw invalidArgument(WenError.member_did_not_request_to_join);
  }

  const space = await spaceDocRef.get();
  const spaceMember = {
    project,
    uid: member,
    parentId: space?.uid!,
    parentCol: COL.SPACE,
    createdOn: dateToTimestamp(dayjs()),
  };

  const spaceUpdateData = {
    totalMembers: build5Db().inc(1),
    totalPendingMembers: build5Db().inc(-1),
  };

  return { spaceMember, space: spaceUpdateData };
};
