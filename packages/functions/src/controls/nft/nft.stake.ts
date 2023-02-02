import { COL, Network, StakeType } from '@soonaverse/interfaces';
import { Database } from '../../database/Database';
import { createNftStakeOrder } from '../../services/payment/nft/nft-stake-service';

export const nftStakeControl = async (owner: string, params: Record<string, unknown>) => {
  const order = await createNftStakeOrder(
    owner,
    params.network as Network,
    params.weeks as number,
    params.type as StakeType,
  );
  await Database.create(COL.TRANSACTION, order);
  return order;
};
