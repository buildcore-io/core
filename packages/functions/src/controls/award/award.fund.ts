import { database } from '@buildcore/database';
import { AwardFundRequest, COL, Transaction } from '@buildcore/interfaces';
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

  await database().doc(COL.TRANSACTION, order.uid).create(order);

  return order;
};
