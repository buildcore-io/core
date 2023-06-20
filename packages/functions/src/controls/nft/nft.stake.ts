import { COL, NftStakeRequest, Transaction } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { createNftStakeOrder } from '../../services/payment/nft/nft-stake-service';

export const nftStakeControl = async (
  owner: string,
  params: NftStakeRequest,
): Promise<Transaction> => {
  const order = await createNftStakeOrder(owner, params.network, params.weeks, params.type);
  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
  await orderDocRef.create(order);
  return order;
};
