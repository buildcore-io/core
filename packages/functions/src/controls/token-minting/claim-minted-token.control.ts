import { COL, ClaimAirdroppedTokensRequest } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { createMintedTokenAirdropCalimOrder } from '../../services/payment/tangle-service/token-claim.service';

export const claimMintedTokenControl = async (
  owner: string,
  params: ClaimAirdroppedTokensRequest,
) => {
  const order = await createMintedTokenAirdropCalimOrder(owner, params.symbol);
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);
  return order;
};
