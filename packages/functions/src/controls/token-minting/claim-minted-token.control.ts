import { build5Db } from '@build-5/database';
import { COL, ClaimAirdroppedTokensRequest } from '@build-5/interfaces';
import { createMintedTokenAirdropClaimOrder } from '../../services/payment/tangle-service/token/token-claim.service';
import { Context } from '../common';

export const claimMintedTokenControl = async ({
  owner,
  params,
  project,
}: Context<ClaimAirdroppedTokensRequest>) => {
  const order = await createMintedTokenAirdropClaimOrder(project, owner, params.symbol);
  await build5Db().doc(COL.TRANSACTION, order.uid).create(order);
  return order;
};
