import {
  AddressValidationRequest,
  COL,
  DEFAULT_NETWORK,
  Member,
  WenError,
} from '@build-5/interfaces';
import { build5Db } from '../firebase/firestore/build5Db';
import { createAddressValidationOrder } from '../services/payment/tangle-service/address-validation.service';
import { invalidArgument } from '../utils/error.utils';

export const validateAddressControl = async (owner: string, params: AddressValidationRequest) => {
  const network = params.network || DEFAULT_NETWORK;
  const member = await build5Db().doc(`${COL.MEMBER}/${owner}`).get<Member>();

  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const order = await createAddressValidationOrder(member.uid, network, params.space);
  await build5Db().doc(`${COL.TRANSACTION}/${order.uid}`).create(order);

  return order;
};
