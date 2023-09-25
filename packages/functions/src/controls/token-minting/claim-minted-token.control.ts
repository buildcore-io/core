import { build5Db } from '@build-5/database';
import { COL, ClaimAirdroppedTokensRequest } from '@build-5/interfaces';
import { Context } from '../../runtime/firebase/common';
import { createMintedTokenAirdropCalimOrder } from '../../services/payment/tangle-service/token/token-claim.service';

export const claimMintedTokenControl = async (
  { project, owner }: Context,
  params: ClaimAirdroppedTokensRequest,
) => {
  const order = await createMintedTokenAirdropCalimOrder(project, owner, params.symbol);
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
  return order;
};
