import { COL, Space, SUB_COL, WenError } from '@build-5/interfaces';
import { soonDb } from '../../../../firebase/firestore/soondb';
import { editSpaceMemberSchema } from '../../../../runtime/firebase/space';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { TransactionService } from '../../transaction-service';

export class SpaceBlockMemberService {
  constructor(readonly transactionService: TransactionService) {}

  public handleBlockMemberRequest = async (owner: string, request: Record<string, unknown>) => {
    await assertValidationAsync(editSpaceMemberSchema, request, { allowUnknown: true });

    const member = request.member as string;
    const { space, blockedMember } = await getBlockMemberUpdateData(
      owner,
      request.uid as string,
      member,
    );

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${request.uid}`);
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
      ref: spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member),
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
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${spaceId}`);
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

  if (space.totalGuardians === 1) {
    const guardian = await spaceDocRef.collection(SUB_COL.GUARDIANS).doc(member).get();
    if (guardian) {
      throw invalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
    }
  }

  const blockedMember = { uid: member, parentId: spaceId, parentCol: COL.SPACE };
  const spaceUpdateData = {
    totalGuardians: soonDb().inc(knockingMember ? 0 : -1),
    totalMembers: soonDb().inc(knockingMember ? 0 : -1),
    totalPendingMembers: soonDb().inc(knockingMember ? -1 : 0),
  };
  return { blockedMember, space: spaceUpdateData };
};
