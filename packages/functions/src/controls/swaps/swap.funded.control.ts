import { build5Db } from '@build-5/database';
import { COL, Swap, SwapSetFundedRequest, SwapStatus } from '@build-5/interfaces';
import {
  asksAreFulfilled,
  assertSwapCanBeSetAsFunded,
  createSwapTransfers,
} from '../../services/payment/swap/swap-service';
import { Context } from '../common';

export const swapFundedControl = async ({
  project,
  owner,
  params,
}: Context<SwapSetFundedRequest>): Promise<Swap> =>
  build5Db().runTransaction(async (transaction) => {
    const swapDocRef = build5Db().doc(`${COL.SWAP}/${params.uid}`);
    const swap = await transaction.get<Swap>(swapDocRef);

    assertSwapCanBeSetAsFunded(owner, swap);

    if (asksAreFulfilled(swap!)) {
      transaction.update(swapDocRef, { status: SwapStatus.FULFILLED });

      const transfers = await createSwapTransfers(project, swap!);
      for (const transfer of transfers) {
        const docRef = build5Db().doc(`${COL.TRANSACTION}/${transfer.uid}`);
        transaction.create(docRef, transfer);
      }
      return { ...swap!, status: SwapStatus.FULFILLED };
    }

    transaction.update(swapDocRef, { status: SwapStatus.FUNDED });
    return swap!;
  });
