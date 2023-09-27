import { build5Db } from '@build-5/database';
import { AwardFundRequest, COL } from '@build-5/interfaces';
import { Context } from '../../runtime/firebase/common';
import {
  createAwardFundOrder,
  getAwardForFunding,
} from '../../services/payment/tangle-service/award/award.fund.service';

export const fundAwardControl = async ({ project, owner }: Context, params: AwardFundRequest) => {
  const award = await getAwardForFunding(owner, params.uid);
  const order = await createAwardFundOrder(project, owner, award);

  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);

  return order;
};
