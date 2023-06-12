import { COL, Network, StakeType } from '@build-5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { createNftStakeOrder } from '../../services/payment/nft/nft-stake-service';

export const nftStakeControl = async (owner: string, params: Record<string, unknown>) => {
  const order = await createNftStakeOrder(
    owner,
    params.network as Network,
    params.weeks as number,
    params.type as StakeType,
  );
  const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
  await orderDocRef.create(order);
  return order;
};
