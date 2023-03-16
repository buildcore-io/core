import { COL, Space, SUB_COL, WenError } from '@soonaverse/interfaces';
import admin, { inc } from '../../../../admin.config';
import { uidSchema } from '../../../../runtime/firebase/common';
import { throwInvalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { TransactionService } from '../../transaction-service';

export class SpaceLeaveService {
  constructor(readonly transactionService: TransactionService) {}

  public handleLeaveSpaceRequest = async (owner: string, request: Record<string, unknown>) => {
    await assertValidationAsync(uidSchema, request, { allowUnknown: true });

    const { space, member } = await getLeaveSpaceData(owner, request.uid as string);

    const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${request.uid}`);

    this.transactionService.updates.push({
      ref: spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner),
      data: {},
      action: 'delete',
    });

    this.transactionService.updates.push({
      ref: spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner),
      data: {},
      action: 'delete',
    });

    this.transactionService.updates.push({
      ref: spaceDocRef,
      data: space,
      action: 'update',
    });

    const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${owner}`);

    this.transactionService.updates.push({
      ref: memberDocRef,
      data: member,
      action: 'set',
      merge: true,
    });

    return { status: 'success' };
  };
}

export const getLeaveSpaceData = async (owner: string, spaceId: string) => {
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${spaceId}`);

  const spaceMember = await spaceDocRef.collection(SUB_COL.MEMBERS).doc(owner).get();
  if (!spaceMember.exists) {
    throw throwInvalidArgument(WenError.you_are_not_part_of_the_space);
  }

  const space = <Space>(await spaceDocRef.get()).data();
  if (space.totalMembers === 1) {
    throw throwInvalidArgument(WenError.at_least_one_member_must_be_in_the_space);
  }

  const guardianDoc = await spaceDocRef.collection(SUB_COL.GUARDIANS).doc(owner).get();
  const isGuardian = guardianDoc.exists;
  if (space.totalGuardians === 1 && isGuardian) {
    throw throwInvalidArgument(WenError.at_least_one_guardian_must_be_in_the_space);
  }

  const spaceUpdateData = {
    totalMembers: inc(-1),
    totalGuardians: inc(isGuardian ? -1 : 0),
  };
  const member = { spaces: { [space.uid]: { uid: space.uid, isMember: false } } };
  return { space: spaceUpdateData, member };
};
