import { database } from '@buildcore/database';
import {
  COL,
  Network,
  TRANSACTION_AUTO_EXPIRY_MS,
  TangleResponse,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { set } from 'lodash';
import { generateRandomAmount } from '../../../../utils/common.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';
import { validateAddressSchemaObject } from './AddressValidationTangleRequestSchema';

export class TangleAddressValidationService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({
    project,
    tran,
    order: tangleOrder,
    tranEntry,
    owner,
    request,
    payment,
  }: HandlerParams) => {
    const params = await assertValidationAsync(validateAddressSchemaObject, request);
    const order = await createAddressValidationOrder(
      project,
      owner,
      tangleOrder.network,
      params.space,
    );
    set(order, 'payload.amount', tranEntry.amount);

    this.transactionService.push({
      ref: database().doc(COL.TRANSACTION, order.uid),
      data: order,
      action: Action.C,
    });

    this.transactionService.createUnlockTransaction(
      payment,
      order,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );

    return {};
  };
}

export const createAddressValidationOrder = async (
  project: string,
  owner: string,
  network: Network,
  spaceId?: string,
) => {
  const spaceDocRef = database().doc(COL.SPACE, spaceId!);
  const space = spaceId ? await spaceDocRef.get() : undefined;
  if (spaceId && !space) {
    throw invalidArgument(WenError.space_does_not_exists);
  }

  if (space) {
    await assertIsGuardian(space.uid, owner);
  } else if (owner.startsWith(network)) {
    throw invalidArgument(WenError.can_not_change_validated_addess);
  }

  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const order: Transaction = {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: space?.uid || '',
    network,
    payload: {
      type: space
        ? TransactionPayloadType.SPACE_ADDRESS_VALIDATION
        : TransactionPayloadType.MEMBER_ADDRESS_VALIDATION,
      amount: generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
    },
    linkedTransactions: [],
  };
  return order;
};
