import { COL, StakeType, TokenStakeRequest } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { createStakeOrder } from '../../services/payment/tangle-service/token/stake.service';

export const depositStakeControl = async (owner: string, params: TokenStakeRequest) => {
  const order = await createStakeOrder(
    owner,
    params.symbol,
    params.weeks,
    params.type as StakeType,
    params.customMetadata,
  );
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
  return order;
};
