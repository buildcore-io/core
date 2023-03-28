import {
  COL,
  Space,
  SpaceMember,
  StakeType,
  SUB_COL,
  TokenDistribution,
  WenError,
} from '@soonaverse/interfaces';
import { soonDb } from '../../../../firebase/firestore/soondb';
import { uidSchema } from '../../../../runtime/firebase/common';
import { serverTime } from '../../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { getTokenForSpace } from '../../../../utils/token.utils';
import { getStakeForType } from '../../../stake.service';
import { TransactionService } from '../../transaction-service';

export class SpaceJoinService {
  constructor(readonly transactionService: TransactionService) {}

  public handleSpaceJoinRequest = async (owner: string, request: Record<string, unknown>) => {
    await assertValidationAsync(uidSchema, request, { allowUnknown: true });

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${request.uid}`);
    const space = <Space | undefined>await spaceDocRef.get();
    if (!space) {
      throw throwInvalidArgument(WenError.space_does_not_exists);
    }

    const { space: spaceUpdateData, spaceMember, member } = await getJoinSpaceData(owner, space);

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

    const memberDocRef = soonDb().doc(`${COL.MEMBER}/${owner}`);
    this.transactionService.push({
      ref: memberDocRef,
      data: member,
      action: 'set',
      merge: true,
    });

    return { status: 'success' };
  };
}

export const getJoinSpaceData = async (owner: string, space: Space) => {
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${space.uid}`);

  const joinedMemberSnap = await spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner).get();
  if (joinedMemberSnap) {
    throw throwInvalidArgument(WenError.you_are_already_part_of_space);
  }

  const blockedMemberSnap = await spaceDocRef.collection(SUB_COL.BLOCKED_MEMBERS).doc(owner).get();
  if (blockedMemberSnap) {
    throw throwInvalidArgument(WenError.you_are_not_allowed_to_join_space);
  }

  const knockingMemberSnap = await spaceDocRef
    .collection(SUB_COL.KNOCKING_MEMBERS)
    .doc(owner)
    .get();
  if (knockingMemberSnap) {
    throw throwInvalidArgument(WenError.member_already_knocking);
  }

  if (space.tokenBased) {
    await assertMemberHasEnoughStakedTokens(space, owner);
  }

  const spaceMember: SpaceMember = {
    uid: owner,
    parentId: space.uid,
    parentCol: COL.SPACE,
    createdOn: serverTime(),
  };
  const spaceUpdateData = {
    totalMembers: soonDb().inc(space.open || space.tokenBased ? 1 : 0),
    totalPendingMembers: soonDb().inc(space.open || space.tokenBased ? 0 : 1),
  };

  const member = { spaces: { [space.uid]: { uid: space.uid, isMember: true } } };

  return { space: spaceUpdateData, spaceMember, member };
};

const assertMemberHasEnoughStakedTokens = async (space: Space, member: string) => {
  const token = await getTokenForSpace(space.uid);
  const distributionDocRef = soonDb().doc(
    `${COL.TOKEN}/${token?.uid}/${SUB_COL.DISTRIBUTION}/${member}`,
  );
  const distribution = await distributionDocRef.get<TokenDistribution>();
  const stakeValue = getStakeForType(distribution, StakeType.DYNAMIC);
  if (stakeValue < (space.minStakedValue || 0)) {
    throw throwInvalidArgument(WenError.not_enough_staked_tokens);
  }
};
