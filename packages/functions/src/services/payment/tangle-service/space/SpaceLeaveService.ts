import { COL, Space, SUB_COL, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../../../../firebase/firestore/soondb';
import { uidSchema } from '../../../../runtime/firebase/common';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { TransactionService } from '../../transaction-service';

export class SpaceLeaveService {
  constructor(readonly transactionService: TransactionService) {}

  public handleLeaveSpaceRequest = async (owner: string, request: Record<string, unknown>) => {
    await assertValidationAsync(uidSchema, request, { allowUnknown: true });

    const { space, member } = await getLeaveSpaceData(owner, request.uid as string);

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${request.uid}`);

    this.transactionService.push({
      ref: spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner),
      data: {},
      action: 'delete',
    });

    this.transactionService.push({
      ref: spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner),
      data: {},
      action: 'delete',
    });

    this.transactionService.push({
      ref: spaceDocRef,
      data: space,
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

export const getLeaveSpaceData = async (owner: string, spaceId: string) => {
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${spaceId}`);

  const spaceMember = await spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner).get();
  if (!spaceMember) {
    throw invalidArgument(WenError.you_are_not_part_of_the_space);
  }

  const space = <Space>await spaceDocRef.get();
  if (space.totalMembers === 1) {
    throw invalidArgument(WenError.at_least_one_member_must_be_in_the_space);
  }

  const guardianDoc = await spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner).get();
  const isGuardian = guardianDoc !== undefined;
  if (space.totalGuardians === 1 && isGuardian) {
    throw invalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
  }

  const spaceUpdateData = {
    totalMembers: soonDb().inc(-1),
    totalGuardians: soonDb().inc(isGuardian ? -1 : 0),
  };
  const member = { spaces: { [space.uid]: { uid: space.uid, isMember: false } } };
  return { space: spaceUpdateData, member };
};
