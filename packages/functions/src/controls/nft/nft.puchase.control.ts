import { COL } from '@soonaverse/interfaces';
import { Database } from '../../database/Database';
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
  await Database.create(COL.TRANSACTION, order);
  return await Database.getById(COL.TRANSACTION, order.uid);
};
