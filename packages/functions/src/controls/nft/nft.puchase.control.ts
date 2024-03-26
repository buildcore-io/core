import { build5Db } from '@build-5/database';
import { COL, NftPurchaseRequest, Transaction } from '@build-5/interfaces';
import { createNftPuchaseOrder } from '../../services/payment/tangle-service/nft/nft-purchase.service';
import { Context } from '../common';

export const orderNftControl = async ({
  ip,
  owner,
  params,
  project,
}: Context<NftPurchaseRequest>): Promise<Transaction> => {
  const order = await createNftPuchaseOrder(project, params.collection, params.nft, owner, ip);
  const orderDocRef = build5Db().doc(COL.TRANSACTION, order.uid);
  await orderDocRef.create(order);
  return (await orderDocRef.get())!;
};
