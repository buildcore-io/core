import { COL, Transaction } from '@build-5/interfaces';
import { soonDb } from '../../firebase/firestore/soondb';
import { createNftPuchaseOrder } from '../../services/payment/tangle-service/nft-purchase.service';

export const orderNftControl = async (
  owner: string,
  params: Record<string, unknown>,
  customParams?: Record<string, unknown>,
) => {
  const order = await createNftPuchaseOrder(
    params.collection as string,
    params.nft as string,
    owner,
    (customParams?.ip || '') as string,
  );
  const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
  await orderDocRef.create(order);

  return await orderDocRef.get<Transaction>();
};
