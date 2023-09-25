import { build5Db } from '@build-5/database';
import { COL, NftPurchaseRequest, Transaction } from '@build-5/interfaces';
import { Context } from '../../runtime/firebase/common';
import { createNftPuchaseOrder } from '../../services/payment/tangle-service/nft/nft-purchase.service';

export const orderNftControl = async (
  { project, owner, ip }: Context,
  params: NftPurchaseRequest,
) => {
  const order = await createNftPuchaseOrder(
    project,
    params.collection,
    params.nft,
    owner,
    ip || '',
  );
  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
  await orderDocRef.create(order);

  return (await orderDocRef.get<Transaction>())!;
};
