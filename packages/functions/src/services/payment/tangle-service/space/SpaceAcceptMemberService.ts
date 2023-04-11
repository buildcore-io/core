import { COL, SpaceMember, SUB_COL, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../../../../firebase/firestore/soondb';
import { editSpaceMemberSchema } from '../../../../runtime/firebase/space';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { TransactionService } from '../../transaction-service';

export class SpaceAcceptMemberService {
  constructor(readonly transactionService: TransactionService) {}

  public handleAcceptMemberRequest = async (owner: string, request: Record<string, unknown>) => {
    await assertValidationAsync(editSpaceMemberSchema, request, { allowUnknown: true });

    const { spaceMember, space } = await acceptSpaceMember(
      owner,
      request.uid as string,
      request.member as string,
    );

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${request.uid}`);
    const spaceMemberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(spaceMember.uid);
    const knockingMemberDocRef = spaceDocRef
      .collection(SUB_COL.KNOCKING_MEMBERS)
      .doc(spaceMember.uid);

    this.transactionService.push({
      ref: spaceMemberDocRef,
      data: spaceMember,
      action: 'set',
    });
    this.transactionService.push({ ref: knockingMemberDocRef, data: {}, action: 'delete' });
    this.transactionService.push({
      ref: spaceDocRef,
      data: space,
      action: 'update',
    });

    return { status: 'success' };
  };
}

export const acceptSpaceMember = async (owner: string, space: string, member: string) => {
  await assertIsGuardian(space, owner);

  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${space}`);
  const knockingMember = await spaceDocRef
    .collection(SUB_COL.KNOCKING_MEMBERS)
    .doc(member)
    .get<SpaceMember>();
  if (!knockingMember) {
    throw invalidArgument(WenError.member_did_not_request_to_join);
  }

  const spaceMember = {
    uid: member,
    parentId: space,
    parentCol: COL.SPACE,
  };

  const spaceUpdateData = {
    totalMembers: soonDb().inc(1),
    totalPendingMembers: soonDb().inc(-1),
  };

  return { spaceMember, space: spaceUpdateData };
};
