import { database } from '@buildcore/database';
import { COL, Space, SUB_COL, TangleResponse, WenError } from '@buildcore/interfaces';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { leaveSpaceSchema } from './SpaceLeaveTangleRequestSchema';

export class SpaceLeaveService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({ owner, request }: HandlerParams) => {
    const params = await assertValidationAsync(leaveSpaceSchema, request);

    const spaceUpdateData = await getLeaveSpaceData(owner, params.uid);

    const spaceDocRef = database().doc(COL.SPACE, params.uid);

    this.transactionService.push({
      ref: database().doc(COL.SPACE, params.uid, SUB_COL.MEMBERS, owner),
      data: undefined,
      action: Action.D,
    });

    this.transactionService.push({
      ref: database().doc(COL.SPACE, params.uid, SUB_COL.GUARDIANS, owner),
      data: undefined,
      action: Action.D,
    });

    this.transactionService.push({
      ref: spaceDocRef,
      data: spaceUpdateData,
      action: Action.U,
    });

    const memberSpaceStats = database().doc(COL.MEMBER, owner);
    this.transactionService.push({
      ref: memberSpaceStats,
      data: { spaces: { [params.uid]: { isMember: false } } },
      action: Action.U,
    });

    return { status: 'success' };
  };
}

export const getLeaveSpaceData = async (owner: string, spaceId: string) => {
  const spaceDocRef = database().doc(COL.SPACE, spaceId);

  const spaceMember = await database().doc(COL.SPACE, spaceId, SUB_COL.MEMBERS, owner).get();
  if (!spaceMember) {
    throw invalidArgument(WenError.you_are_not_part_of_the_space);
  }

  const space = <Space>await spaceDocRef.get();
  if (space.totalMembers === 1) {
    throw invalidArgument(WenError.at_least_one_member_must_be_in_the_space);
  }

  const guardianDoc = await database().doc(COL.SPACE, spaceId, SUB_COL.GUARDIANS, owner).get();
  const isGuardian = guardianDoc !== undefined;
  if (space.totalGuardians === 1 && isGuardian) {
    throw invalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
  }

  return {
    totalMembers: database().inc(-1),
    totalGuardians: database().inc(isGuardian ? -1 : 0),
  };
};
