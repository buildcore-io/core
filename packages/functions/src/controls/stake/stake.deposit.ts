import { COL, StakeType } from '@build-5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { createStakeOrder } from '../../services/payment/tangle-service/stake.service';

export const depositStakeControl = async (owner: string, params: Record<string, unknown>) => {
  const order = await createStakeOrder(
    owner,
    params.symbol as string,
    params.weeks as number,
    params.type as StakeType,
    params.customMetadata as Record<string, unknown>,
  );
  await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
  return order;
};
