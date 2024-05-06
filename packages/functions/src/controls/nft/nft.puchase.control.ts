import { database } from '@buildcore/database';
import { COL, NftPurchaseRequest, Transaction } from '@buildcore/interfaces';
import { createNftPuchaseOrder } from '../../services/payment/tangle-service/nft/nft-purchase.service';
import { Context } from '../common';

export const orderNftControl = async ({
  ip,
  owner,
  params,
  project,
}: Context<NftPurchaseRequest>): Promise<Transaction> => {
  const order = await createNftPuchaseOrder(project, params.collection, params.nft, owner, ip);
  const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
  await orderDocRef.create(order);
  return (await orderDocRef.get())!;
};
