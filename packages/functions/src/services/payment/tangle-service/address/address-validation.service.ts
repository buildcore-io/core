import {
  BaseTangleResponse,
  COL,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  Space,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { set } from 'lodash';
import { build5Db } from '../../../../firebase/firestore/build5Db';
import { generateRandomAmount } from '../../../../utils/common.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { invalidArgument } from '../../../../utils/error.utils';
import { assertValidationAsync } from '../../../../utils/schema.utils';
import { assertIsGuardian } from '../../../../utils/token.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet.service';
import { TransactionService } from '../../transaction-service';
import { validateAddressSchemaObject } from './AddressValidationTangleRequestSchema';

export class TangleAddressValidationService {
  constructor(readonly transactionService: TransactionService) {}

  public handeAddressValidation = async (
    tangleOrder: Transaction,
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    owner: string,
    request: Record<string, unknown>,
  ): Promise<BaseTangleResponse | undefined> => {
    const params = await assertValidationAsync(validateAddressSchemaObject, request);

    const order = await createAddressValidationOrder(
      owner,
      (params.network as Network) || tangleOrder.network,
      params.space,
    );
    set(order, 'payload.amount', tranEntry.amount);

    this.transactionService.push({
      ref: build5Db().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: order,
      action: 'set',
    });

    this.transactionService.createUnlockTransaction(
      order,
      tran,
      tranEntry,
      TransactionPayloadType.TANGLE_TRANSFER,
      tranEntry.outputId,
    );
    return;
  };
}

export const createAddressValidationOrder = async (
  owner: string,
  network: Network,
  spaceId?: string,
) => {
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${spaceId}`);
  const space = spaceId ? <Space | undefined>await spaceDocRef.get() : undefined;
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
