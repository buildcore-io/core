import { COL, StakeType } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { createStakeOrder } from '../../services/payment/tangle-service/stake.service';

export const depositStakeControl = async (owner: string, params: Record<string, unknown>) => {
  const order = await createStakeOrder(
    owner,
    params.symbol as string,
    params.weeks as number,
    params.type as StakeType,
    params.customMetadata as Record<string, unknown>,
  );
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
  return order;
};
