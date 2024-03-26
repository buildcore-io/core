import { build5Db } from '@build-5/database';
import { COL, Swap, SwapRejectRequest, SwapStatus } from '@build-5/interfaces';
import { rejectSwap } from '../../services/payment/swap/swap-service';
import { Context } from '../common';

export const swapRejectControl = ({
  project,
  owner,
  params,
}: Context<SwapRejectRequest>): Promise<Swap> =>
  build5Db().runTransaction(async (transaction) => {
    const swapDocRef = build5Db().doc(COL.SWAP, params.uid);
    const swap = await transaction.get(swapDocRef);

    const credits = rejectSwap(project, owner, swap);

    for (const credit of credits) {
      const docRef = build5Db().doc(COL.TRANSACTION, credit.uid);
      await transaction.create(docRef, credit);
    }

    await transaction.update(swapDocRef, { status: SwapStatus.REJECTED });

    return { ...swap!, status: SwapStatus.REJECTED };
  });
