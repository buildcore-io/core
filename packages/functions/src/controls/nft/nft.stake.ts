import { build5Db } from '@build-5/database';
import { COL, Network, NftStakeRequest, StakeType, Transaction } from '@build-5/interfaces';
import { Context } from '../common';
import { createNftStakeOrder } from '../../services/payment/nft/nft-stake.service';

export const nftStakeControl = async ({
  owner,
  params,
  project,
}: Context<NftStakeRequest>): Promise<Transaction> => {
  const order = await createNftStakeOrder(
    project,
    owner,
    params.network as Network,
    params.weeks,
    params.type as StakeType,
  );
  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
  await orderDocRef.create(order);
  return order;
};
