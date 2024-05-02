import { build5Db } from '@build-5/database';
import {
  AddressValidationRequest,
  COL,
  DEFAULT_NETWORK,
  Network,
  Transaction,
  WenError,
} from '@build-5/interfaces';
import { createAddressValidationOrder } from '../../services/payment/tangle-service/address/address-validation.service';
import { invalidArgument } from '../../utils/error.utils';
import { Context } from '../common';

export const validateAddressControl = async ({
  owner,
  params,
  project,
}: Context<AddressValidationRequest>): Promise<Transaction> => {
  const network = (params.network as Network) || DEFAULT_NETWORK;
  const memberDocRef = build5Db().doc(COL.MEMBER, owner);
  const member = await memberDocRef.get();

  if (!member) {
    throw invalidArgument(WenError.member_does_not_exists);
  }

  const order = await createAddressValidationOrder(project, owner, network, params.space);
  await build5Db().doc(COL.TRANSACTION, order.uid).create(order);

  return order;
};
