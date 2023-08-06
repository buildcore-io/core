import { COL, Space, SpaceMemberUpsertTangleRequest, SUB_COL, WenError } from '@build-5/interfaces';
import { BaseTangleResponse } from '@build-5/interfaces/lib/api/tangle/common';
import { build5Db } from '../../../../firebase/firestore/build5Db';
import { editSpaceMemberSchema } from '../../../../runtime/firebase/space';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { toJoiObject } from '../../../joi/common';
import { TransactionService } from '../../transaction-service';

const schema = toJoiObject<SpaceMemberUpsertTangleRequest>(editSpaceMemberSchema);
export class SpaceBlockMemberService {
  constructor(readonly transactionService: TransactionService) {}

  public handleBlockMemberRequest = async (
    owner: string,
    request: Record<string, unknown>,
  ): Promise<BaseTangleResponse> => {
    delete request.requestType;
    const params = await assertValidationAsync(schema, request);

    const member = params.member;
    const { space, blockedMember } = await getBlockMemberUpdateData(owner, params.uid, member);

    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
    const blockedMemberDocRef = spaceDocRef.collection(SUB_COL.BLOCKED_MEMBERS).doc(member);

    this.transactionService.push({
      ref: blockedMemberDocRef,
      data: blockedMember,
      action: 'set',
    });

    this.transactionService.push({
      ref: spaceDocRef.collection(SUB_COL.MEMBERS).doc(member),
      data: {},
      action: 'delete',
    });

    this.transactionService.push({
      ref: spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).doc(member),
      data: {},
      action: 'delete',
    });

    this.transactionService.push({
      ref: spaceDocRef,
      data: space,
      action: 'update',
    });

    return { status: 'success' };
  };
}

export const getBlockMemberUpdateData = async (owner: string, spaceId: string, member: string) => {
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${spaceId}`);
  await assertIsGuardian(spaceId, owner);

  const spaceMember = await spaceDocRef.collection(SUB_COL.MEMBERS).doc(member).get();
  const knockingMember = await spaceDocRef.collection(SUB_COL.KNOCKING_MEMBERS).doc(member).get();
  if (!spaceMember && !knockingMember) {
    throw invalidArgument(WenError.member_is_not_part_of_the_space);
  }

  const blockedMemberDocRef = spaceDocRef.collection(SUB_COL.BLOCKED_MEMBERS).doc(member);
  const blockedMemberDoc = await blockedMemberDocRef.get();
  if (blockedMemberDoc) {
    throw invalidArgument(WenError.member_is_already_blocked);
  }

  const space = <Space>await spaceDocRef.get();
  if (space.totalMembers === 1) {
    throw invalidArgument(WenError.at_least_one_member_must_be_in_the_space);
  }

  const guardian = await spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member).get();
  if (guardian) {
    throw invalidArgument(WenError.can_not_block_guardian);
  }

  const blockedMember = { uid: member, parentId: spaceId, parentCol: COL.SPACE };
  const spaceUpdateData = {
    totalMembers: build5Db().inc(spaceMember ? -1 : 0),
    totalPendingMembers: build5Db().inc(knockingMember ? -1 : 0),
  };
  return { blockedMember, space: spaceUpdateData };
};
