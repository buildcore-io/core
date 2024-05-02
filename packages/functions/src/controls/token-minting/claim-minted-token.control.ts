import { database } from '@buildcore/database';
import { COL, ClaimAirdroppedTokensRequest } from '@buildcore/interfaces';
import { createMintedTokenAirdropClaimOrder } from '../../services/payment/tangle-service/token/token-claim.service';
import { Context } from '../common';

export const claimMintedTokenControl = async ({
  owner,
  params,
  project,
}: Context<ClaimAirdroppedTokensRequest>) => {
  const order = await createMintedTokenAirdropClaimOrder(project, owner, params.symbol);
  await database().doc(COL.TRANSACTION, order.uid).create(order);
  return order;
};
