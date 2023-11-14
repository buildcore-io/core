import { build5Db } from '@build-5/database';
import {
  BaseTangleResponse,
  COL,
  Space,
  SpaceMember,
  StakeType,
  SUB_COL,
  TokenDistribution,
  WenError,
} from '@build-5/interfaces';
import { getProject } from '../../../../utils/common.utils';
import { serverTime } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getTokenForSpace } from '../../../../utils/token.utils';
import { getStakeForType } from '../../../stake.service';
import { BaseService, HandlerParams } from '../../base';
import { joinSpaceSchema } from './SpaceJoinTangleRequestSchema';

export class SpaceJoinService extends BaseService {
  public handleRequest = async ({
    order,
    owner,
    request,
  }: HandlerParams): Promise<BaseTangleResponse> => {
    const params = await assertValidationAsync(joinSpaceSchema, request);

    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
    const space = <Space | undefined>await spaceDocRef.get();
    if (!space) {
      throw invalidArgument(WenError.space_does_not_exists);
    }

    const {
      space: spaceUpdateData,
      spaceMember,
      member,
    } = await getJoinSpaceData(getProject(order), owner, space);

    const joiningMemberDocRef = spaceDocRef
      .collection(space.open || space.tokenBased ? SUB_COL.MEMBERS : SUB_COL.KNOCKING_MEMBERS)
      .doc(owner);
    this.transactionService.push({
      ref: joiningMemberDocRef,
      data: spaceMember,
      action: 'set',
    });

    this.transactionService.push({
      ref: spaceDocRef,
      data: spaceUpdateData,
      action: 'update',
    });

    const memberDocRef = build5Db().doc(`${COL.MEMBER}/${owner}`);
    this.transactionService.push({
      ref: memberDocRef,
      data: member,
      action: 'set',
      merge: true,
    });

    return { status: 'success' };
  };
}

export const getJoinSpaceData = async (project: string, owner: string, space: Space) => {
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${space.uid}`);

  const joinedMemberSnap = await spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner).get();
  if (joinedMemberSnap) {
    throw invalidArgument(WenError.you_are_already_part_of_space);
  }

  const blockedMemberSnap = await spaceDocRef.collection(SUB_COL.BLOCKED_MEMBERS).doc(owner).get();
  if (blockedMemberSnap) {
    throw invalidArgument(WenError.you_are_not_allowed_to_join_space);
  }

  const knockingMemberSnap = await spaceDocRef
    .collection(SUB_COL.KNOCKING_MEMBERS)
    .doc(owner)
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
    totalMembers: build5Db().inc(space.open || space.tokenBased ? 1 : 0),
    totalPendingMembers: build5Db().inc(space.open || space.tokenBased ? 0 : 1),
  };

  const member = { spaces: { [space.uid]: { uid: space.uid, isMember: true } } };

  return { space: spaceUpdateData, spaceMember, member };
};

const assertMemberHasEnoughStakedTokens = async (space: Space, member: string) => {
  const token = await getTokenForSpace(space.uid);
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token?.uid}`);
  const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member);
  const distribution = await distributionDocRef.get<TokenDistribution>();
  const stakeValue = getStakeForType(distribution, StakeType.DYNAMIC);
  if (stakeValue < (space.minStakedValue || 0)) {
    throw invalidArgument(WenError.not_enough_staked_tokens);
  }
};
