import { database } from '@buildcore/database';
import {
  COL,
  Space,
  SpaceMember,
  StakeType,
  SUB_COL,
  TangleResponse,
  WenError,
} from '@buildcore/interfaces';
import { getProject } from '../../../../utils/common.utils';
import { serverTime } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getTokenForSpace } from '../../../../utils/token.utils';
import { getStakeForType } from '../../../stake.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { joinSpaceSchema } from './SpaceJoinTangleRequestSchema';

export class SpaceJoinService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({ order, owner, request }: HandlerParams) => {
    const params = await assertValidationAsync(joinSpaceSchema, request);

    const spaceDocRef = database().doc(COL.SPACE, params.uid);
    const space = <Space | undefined>await spaceDocRef.get();
    if (!space) {
      throw invalidArgument(WenError.space_does_not_exists);
    }

    const { space: spaceUpdateData, spaceMember } = await getJoinSpaceData(
      getProject(order),
      owner,
      space,
    );

    const subCol = space.open || space.tokenBased ? SUB_COL.MEMBERS : SUB_COL.KNOCKING_MEMBERS;
    const joiningMemberDocRef = database().doc(COL.SPACE, params.uid, subCol, owner);
    this.transactionService.push({
      ref: joiningMemberDocRef,
      data: spaceMember,
      action: Action.C,
    });

    this.transactionService.push({
      ref: spaceDocRef,
      data: spaceUpdateData,
      action: Action.U,
    });

    const memberDocRef = database().doc(COL.MEMBER, owner);
    this.transactionService.push({
      ref: memberDocRef,
      data: { spaces: { [space.uid]: { uid: space.uid, isMember: true } } },
      action: Action.U,
    });

    return { status: 'success' };
  };
}

export const getJoinSpaceData = async (project: string, owner: string, space: Space) => {
  const joinedMemberSnap = await database().doc(COL.SPACE, space.uid, SUB_COL.MEMBERS, owner).get();
  if (joinedMemberSnap) {
    throw invalidArgument(WenError.you_are_already_part_of_space);
  }

  const blockedMemberSnap = await database()
    .doc(COL.SPACE, space.uid, SUB_COL.BLOCKED_MEMBERS, owner)
    .get();
  if (blockedMemberSnap) {
    throw invalidArgument(WenError.you_are_not_allowed_to_join_space);
  }

  const knockingMemberSnap = await database()
    .doc(COL.SPACE, space.uid, SUB_COL.KNOCKING_MEMBERS, owner)
    .get();
  if (knockingMemberSnap) {
    throw invalidArgument(WenError.member_already_knocking);
  }

  if (space.tokenBased) {
    await assertMemberHasEnoughStakedTokens(space, owner);
  }

  const spaceMember: SpaceMember = {
    project,
    uid: owner,
    parentId: space.uid,
    parentCol: COL.SPACE,
    createdOn: serverTime(),
  };
  const spaceUpdateData = {
    totalMembers: database().inc(space.open || space.tokenBased ? 1 : 0),
    totalPendingMembers: database().inc(space.open || space.tokenBased ? 0 : 1),
  };

  const member = { spaces: { [space.uid]: { uid: space.uid, isMember: true } } };

  return { space: spaceUpdateData, spaceMember, member };
};

const assertMemberHasEnoughStakedTokens = async (space: Space, member: string) => {
  const token = await getTokenForSpace(space.uid);
  const distributionDocRef = database().doc(COL.TOKEN, token?.uid!, SUB_COL.DISTRIBUTION, member);
  const distribution = await distributionDocRef.get();
  const stakeValue = getStakeForType(distribution, StakeType.DYNAMIC);
  if (stakeValue < (space.minStakedValue || 0)) {
    throw invalidArgument(WenError.not_enough_staked_tokens);
  }
};
