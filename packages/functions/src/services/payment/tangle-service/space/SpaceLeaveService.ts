import { COL, Space, SpaceLeaveTangleRequest, SUB_COL, WenError } from '@build-5/interfaces';
import { BaseTangleResponse } from '@build-5/interfaces/lib/api/tangle/common';
import { build5Db } from '../../../../firebase/firestore/build5Db';
import { uidSchema } from '../../../../runtime/firebase/common';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { toJoiObject } from '../../../joi/common';
import { TransactionService } from '../../transaction-service';

const schema = toJoiObject<SpaceLeaveTangleRequest>(uidSchema);

export class SpaceLeaveService {
  constructor(readonly transactionService: TransactionService) {}

  public handleLeaveSpaceRequest = async (
    owner: string,
    request: Record<string, unknown>,
  ): Promise<BaseTangleResponse> => {
    delete request.requestType;
    const params = await assertValidationAsync(schema, request);

    const { space, member } = await getLeaveSpaceData(owner, params.uid);

    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);

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

export const getLeaveSpaceData = async (owner: string, spaceId: string) => {
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${spaceId}`);

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
    totalMembers: build5Db().inc(-1),
    totalGuardians: build5Db().inc(isGuardian ? -1 : 0),
  };
  const member = { spaces: { [space.uid]: { uid: space.uid, isMember: false } } };
  return { space: spaceUpdateData, member };
};
