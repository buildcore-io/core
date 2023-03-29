import { COL, DEFAULT_NETWORK, Member, Network, WenError } from '@soonaverse/interfaces';
import { soonDb } from '../firebase/firestore/soondb';
import { createAddressValidationOrder } from '../services/payment/tangle-service/address-validation.service';
import { throwInvalidArgument } from '../utils/error.utils';

export const validateAddressControl = async (owner: string, params: Record<string, unknown>) => {
  const network = (params.network as Network) || DEFAULT_NETWORK;
  const member = await soonDb().doc(`${COL.MEMBER}/${owner}`).get<Member>();

  if (!member) {
    throw throwInvalidArgument(WenError.member_does_not_exists);
  }

  const order = await createAddressValidationOrder(member.uid, network, params.space as string);
  await soonDb().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);

  return order;
};
