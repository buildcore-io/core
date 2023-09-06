import { build5Db } from '@build-5/database';
import { COL, ClaimAirdroppedTokensRequest } from '@build-5/interfaces';
import { createMintedTokenAirdropCalimOrder } from '../../services/payment/tangle-service/token/token-claim.service';

export const claimMintedTokenControl = async (
  owner: string,
  params: ClaimAirdroppedTokensRequest,
) => {
  const order = await createMintedTokenAirdropCalimOrder(owner, params.symbol);
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
  return order;
};
