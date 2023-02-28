import { COL } from '@soonaverse/interfaces';
import { Database } from '../../database/Database';
import {
  createAwardFundOrder,
  getAwardForFunding,
} from '../../services/payment/tangle-service/award/award.fund.service';

export const fundAwardControl = async (owner: string, params: Record<string, unknown>) => {
  const award = await getAwardForFunding(owner, params.uid as string);
  const order = await createAwardFundOrder(owner, award);
  await Database.create(COL.TRANSACTION, order);
  return order;
};
