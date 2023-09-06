import { build5Db } from '@build-5/database';
import { BaseTangleResponse, COL, SUB_COL } from '@build-5/interfaces';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { TransactionService } from '../../transaction-service';
import { editSpaceMemberSchemaObject } from './SpaceEditMemberTangleRequestSchema';

export class SpaceDeclineMemberService {
  constructor(readonly transactionService: TransactionService) {}

  public handleDeclineMemberRequest = async (
    owner: string,
    request: Record<string, unknown>,
  ): Promise<BaseTangleResponse> => {
    const params = await assertValidationAsync(editSpaceMemberSchemaObject, request);

    await assertIsGuardian(params.uid, owner);

    const spaceDocRef = build5Db().doc(`${COL.SPACE}/${params.uid}`);
    const knockingMemberDocRef = spaceDocRef
      .collection(SUB_COL.KNOCKING_MEMBERS)
      .doc(params.member);

    const knockingMember = await knockingMemberDocRef.get();

    this.transactionService.push({ ref: knockingMemberDocRef, data: {}, action: 'delete' });

    this.transactionService.push({
      ref: spaceDocRef,
      data: { totalPendingMembers: build5Db().inc(knockingMember ? -1 : 0) },
      action: 'update',
    });

    return { status: 'success' };
  };
}
