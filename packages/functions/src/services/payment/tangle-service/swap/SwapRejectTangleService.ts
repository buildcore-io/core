import { build5Db } from '@build-5/database';
import { COL, SwapStatus, TangleResponse } from '@build-5/interfaces';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { rejectSwap } from '../../swap/swap-service';
import { Action } from '../../transaction-service';
import { swapRejectTangleSchema } from './SwapRejectTangleRequestSchema';

export class SwapRejectTangleService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    project,
    owner,
    request,
  }: HandlerParams): Promise<TangleResponse> => {
    const params = await assertValidationAsync(swapRejectTangleSchema, request);

    const swapDocRef = build5Db().doc(COL.SWAP, params.uid);
    const swap = await this.transaction.get(swapDocRef);

    const credits = rejectSwap(project, owner, swap);

    for (const credit of credits) {
      const docRef = build5Db().doc(COL.TRANSACTION, credit.uid);
      this.transactionService.push({ ref: docRef, data: credit, action: Action.C });
    }

    this.transactionService.push({
      ref: swapDocRef,
      data: { status: SwapStatus.REJECTED },
      action: Action.U,
    });

    return { status: 'success' };
  };
}
