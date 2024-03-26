import { build5Db } from '@build-5/database';
import { COL, SwapStatus, TangleResponse } from '@build-5/interfaces';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import {
  asksAreFulfilled,
  assertSwapCanBeSetAsFunded,
  createSwapTransfers,
} from '../../swap/swap-service';
import { Action } from '../../transaction-service';
import { swapSetFundedTangleSchema } from './SwapSetFundedTangleRequestSchema';

export class SwapSetFundedTangleService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    project,
    owner,
    request,
  }: HandlerParams): Promise<TangleResponse> => {
    const params = await assertValidationAsync(swapSetFundedTangleSchema, request);

    const swapDocRef = build5Db().doc(COL.SWAP, params.uid);
    const swap = await this.transaction.get(swapDocRef);

    assertSwapCanBeSetAsFunded(owner, swap);

    if (asksAreFulfilled(swap!)) {
      const transfers = await createSwapTransfers(project, swap!);
      for (const transfer of transfers) {
        this.transactionService.push({
          ref: build5Db().doc(COL.TRANSACTION, transfer.uid),
          data: transfer,
          action: Action.C,
        });
      }

      this.transactionService.push({
        ref: swapDocRef,
        data: { status: SwapStatus.FULFILLED },
        action: Action.U,
      });

      return { status: 'success' };
    }

    this.transactionService.push({
      ref: swapDocRef,
      data: { status: SwapStatus.FUNDED },
      action: Action.U,
    });

    return { status: 'success' };
  };
}
