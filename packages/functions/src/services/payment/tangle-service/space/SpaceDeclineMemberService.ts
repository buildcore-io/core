import { COL, SUB_COL, SpaceMemberUpsertTangleRequest } from '@build-5/interfaces';
import { BaseTangleResponse } from '@build-5/interfaces/lib/api/tangle/common';
import { build5Db } from '../../../../firebase/firestore/build5Db';
import { editSpaceMemberSchema } from '../../../../runtime/firebase/space';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { toJoiObject } from '../../../joi/common';
import { TransactionService } from '../../transaction-service';

const schema = toJoiObject<SpaceMemberUpsertTangleRequest>(editSpaceMemberSchema);
export class SpaceDeclineMemberService {
  constructor(readonly transactionService: TransactionService) {}

  public handleDeclineMemberRequest = async (
    owner: string,
    request: Record<string, unknown>,
  ): Promise<BaseTangleResponse> => {
    delete request.requestType;
    const params = await assertValidationAsync(schema, request);

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
