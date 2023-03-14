import { COL } from '@soonaverse/interfaces';
import { soonDb } from '../../database/wrapper/soondb';
import {
  createAwardFundOrder,
  getAwardForFunding,
} from '../../services/payment/tangle-service/award/award.fund.service';

export const fundAwardControl = async (owner: string, params: Record<string, unknown>) => {
  const award = await getAwardForFunding(owner, params.uid as string);
  const order = await createAwardFundOrder(owner, award);

  await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);

  return order;
};
