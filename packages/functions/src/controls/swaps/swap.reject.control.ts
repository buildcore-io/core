import { database } from '@buildcore/database';
import { COL, Swap, SwapRejectRequest, SwapStatus } from '@buildcore/interfaces';
import { rejectSwap } from '../../services/payment/swap/swap-service';
import { Context } from '../common';

export const swapRejectControl = ({
  project,
  owner,
  params,
}: Context<SwapRejectRequest>): Promise<Swap> =>
  database().runTransaction(async (transaction) => {
    const swapDocRef = database().doc(COL.SWAP, params.uid);
    const swap = await transaction.get(swapDocRef);

    const credits = rejectSwap(project, owner, swap);

    for (const credit of credits) {
      const docRef = database().doc(COL.TRANSACTION, credit.uid);
      await transaction.create(docRef, credit);
    }

    await transaction.update(swapDocRef, { status: SwapStatus.REJECTED });

    return { ...swap!, status: SwapStatus.REJECTED };
  });
