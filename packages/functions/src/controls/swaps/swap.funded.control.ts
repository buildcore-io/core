import { database } from '@buildcore/database';
import { COL, Swap, SwapSetFundedRequest, SwapStatus } from '@buildcore/interfaces';
import {
  asksAreFulfilled,
  assertSwapCanBeSetAsFunded,
  createSwapTransfers,
} from '../../services/payment/swap/swap-service';
import { Context } from '../common';

export const swapFundedControl = ({
  project,
  owner,
  params,
}: Context<SwapSetFundedRequest>): Promise<Swap> =>
  database().runTransaction(async (transaction) => {
    const swapDocRef = database().doc(COL.SWAP, params.uid);
    const swap = await transaction.get(swapDocRef);

    assertSwapCanBeSetAsFunded(owner, swap);

    if (asksAreFulfilled(swap!)) {
      await transaction.update(swapDocRef, { status: SwapStatus.FULFILLED });

      const transfers = await createSwapTransfers(project, swap!);
      for (const transfer of transfers) {
        const docRef = database().doc(COL.TRANSACTION, transfer.uid);
        await transaction.create(docRef, transfer);
      }
      return { ...swap!, status: SwapStatus.FULFILLED };
    }

    await transaction.update(swapDocRef, { status: SwapStatus.FUNDED });
    return swap!;
  });
