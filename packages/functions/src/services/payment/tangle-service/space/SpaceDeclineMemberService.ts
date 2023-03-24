import { COL, SUB_COL } from '@soonaverse/interfaces';
import { soonDb } from '../../../../firebase/firestore/soondb';
import { editSpaceMemberSchema } from '../../../../runtime/firebase/space';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { TransactionService } from '../../transaction-service';

export class SpaceDeclineMemberService {
  constructor(readonly transactionService: TransactionService) {}

  public handleDeclineMemberRequest = async (owner: string, request: Record<string, unknown>) => {
    await assertValidationAsync(editSpaceMemberSchema, request, { allowUnknown: true });

    await assertIsGuardian(request.uid as string, owner);

    const spaceDocRef = soonDb().doc(`${COL.SPACE}/${request.uid}`);
    const knockingMemberDocRef = spaceDocRef
      .collection(SUB_COL.KNOCKING_MEMBERS)
      .doc(request.member as string);

    const knockingMember = await knockingMemberDocRef.get();

    this.transactionService.push({ ref: knockingMemberDocRef, data: {}, action: 'delete' });

    this.transactionService.push({
      ref: spaceDocRef,
      data: { totalPendingMembers: soonDb().inc(knockingMember ? -1 : 0) },
      action: 'update',
    });

    return { status: 'success' };
  };
}
