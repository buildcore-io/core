import { COL, NftPurchaseRequest, Transaction } from '@build-5/interfaces';
import { build5Db } from '../../firebase/firestore/build5Db';
import { createNftPuchaseOrder } from '../../services/payment/tangle-service/nft/nft-purchase.service';

export const orderNftControl = async (
  owner: string,
  params: NftPurchaseRequest,
  customParams?: Record<string, unknown>,
): Promise<Transaction> => {
  const order = await createNftPuchaseOrder(
    params.collection,
    params.nft,
    owner,
    (customParams?.ip || '') as string,
  );
  const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
  await orderDocRef.create(order);

  return (await orderDocRef.get<Transaction>())!;
};
