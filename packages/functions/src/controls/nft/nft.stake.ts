import { COL, Network, NftStakeRequest, StakeType, Transaction } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { createNftStakeOrder } from '../../services/payment/nft/nft-stake-service';

export const nftStakeControl = async (
  owner: string,
  params: NftStakeRequest,
): Promise<Transaction> => {
  const order = await createNftStakeOrder(
    owner,
    params.network as Network,
    params.weeks,
    params.type as StakeType,
  );
  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
  await orderDocRef.create(order);
  return order;
};
