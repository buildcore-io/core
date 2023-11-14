import { build5Db } from '@build-5/database';
import { AwardFundRequest, COL, Transaction } from '@build-5/interfaces';
import {
  createAwardFundOrder,
  getAwardForFunding,
} from '../../services/payment/tangle-service/award/award.fund.service';
import { Context } from '../common';

export const fundAwardControl = async ({
  owner,
  params,
  project,
}: Context<AwardFundRequest>): Promise<Transaction> => {
  const award = await getAwardForFunding(owner, params.uid);
  const order = await createAwardFundOrder(project, owner, award);

  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);

  return order;
};
