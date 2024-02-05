import { build5Db } from '@build-5/database';
import { COL, Swap, SwapStatus, TangleResponse } from '@build-5/interfaces';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { BaseTangleService, HandlerParams } from '../../base';
import { rejectSwap } from '../../swap/swap-service';
import { swapRejectTangleSchema } from './SwapRejectTangleRequestSchema';

export class SwapRejectTangleService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    project,
    owner,
    request,
  }: HandlerParams): Promise<TangleResponse> => {
    const params = await assertValidationAsync(swapRejectTangleSchema, request);

    const swapDocRef = build5Db().doc(`${COL.SWAP}/${params.uid}`);
    const swap = await this.transactionService.get<Swap>(swapDocRef);

    const credits = rejectSwap(project, owner, swap);

    for (const credit of credits) {
      const docRef = build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`);
      this.transactionService.push({ ref: docRef, data: credit, action: 'set' });
    }

    this.transactionService.push({
      ref: swapDocRef,
      data: { status: SwapStatus.REJECTED },
      action: 'update',
    });

    return { status: 'success' };
  };
}
