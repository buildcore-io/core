import { COL, StakeType, TokenStakeRequest } from '@build-5/interfaces';
import { Context } from '../../runtime/firebase/common';
import { createStakeOrder } from '../../services/payment/tangle-service/token/stake.service';
import { build5Db } from '@build-5/database';

export const depositStakeControl = async ({ owner }: Context, params: TokenStakeRequest) => {
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
