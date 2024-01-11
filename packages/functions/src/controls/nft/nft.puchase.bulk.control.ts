import { build5Db } from '@build-5/database';
import { COL, NftPurchaseBulkRequest, Transaction } from '@build-5/interfaces';
import { createNftBulkOrder } from '../../services/payment/tangle-service/nft/nft-purchase.bulk.service';
import { Context } from '../common';

export const orderNftBulkControl = async ({
  ip,
  owner,
  params,
  project,
}: Context<NftPurchaseBulkRequest>): Promise<Transaction> => {
  const order = await createNftBulkOrder(project, params.orders, owner, ip);
  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
  await orderDocRef.create(order);

  return (await orderDocRef.get<Transaction>())!;
};
