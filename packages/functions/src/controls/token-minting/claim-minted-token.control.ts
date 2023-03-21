import { COL } from '@soonaverse/interfaces';
import { soonDb } from '../../database/wrapper/soondb';
import { createMintedTokenAirdropCalimOrder } from '../../services/payment/tangle-service/token-claim.service';

export const claimMintedTokenControl = async (owner: string, params: Record<string, unknown>) => {
  const order = await createMintedTokenAirdropCalimOrder(owner, params.symbol as string);
  await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
  return order;
};
