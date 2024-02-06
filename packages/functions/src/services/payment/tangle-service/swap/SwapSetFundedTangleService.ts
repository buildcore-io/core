import { build5Db } from '@build-5/database';
import { COL, Swap, SwapStatus, TangleResponse } from '@build-5/interfaces';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import {
  asksAreFulfilled,
  assertSwapCanBeSetAsFunded,
  createSwapTransfers,
} from '../../swap/swap-service';
import { swapSetFundedTangleSchema } from './SwapSetFundedTangleRequestSchema';

export class SwapSetFundedTangleService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    project,
    owner,
    request,
  }: HandlerParams): Promise<TangleResponse> => {
    const params = await assertValidationAsync(swapSetFundedTangleSchema, request);

    const swapDocRef = build5Db().doc(`${COL.SWAP}/${params.uid}`);
    const swap = await this.transactionService.get<Swap>(swapDocRef);

    assertSwapCanBeSetAsFunded(owner, swap);

    if (asksAreFulfilled(swap!)) {
      const transfers = await createSwapTransfers(project, swap!);
      for (const transfer of transfers) {
        const docRef = build5Db().doc(`${COL.TRANSACTION}/${transfer.uid}`);
        this.transactionService.push({
          ref: docRef,
          data: transfer,
          action: 'set',
        });
      }

      this.transactionService.push({
        ref: swapDocRef,
        data: { status: SwapStatus.FULFILLED },
        action: 'update',
      });

      return { status: 'success' };
    }

    this.transactionService.push({
      ref: swapDocRef,
      data: { status: SwapStatus.FUNDED },
      action: 'update',
    });

    return { status: 'success' };
  };
}
