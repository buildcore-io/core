import {
  COL,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  Space,
  Transaction,
  TransactionOrder,
  TransactionOrderType,
  TransactionType,
  TransactionUnlockType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { set } from 'lodash';
import admin from '../../../admin.config';
import { validateAddressSchema } from '../../../controls/address.control';
import { getAddress } from '../../../utils/address.utils';
import { generateRandomAmount } from '../../../utils/common.utils';
import { dateToTimestamp, serverTime } from '../../../utils/dateTime.utils';
import { throwInvalidArgument } from '../../../utils/error.utils';
import { assertValidationAsync } from '../../../utils/schema.utils';
import { assertIsGuardian } from '../../../utils/token.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { WalletService } from '../../wallet/wallet';
import { TransactionService } from '../transaction-service';

export class TangleAddressValidationService {
  constructor(readonly transactionService: TransactionService) {}

  public handeAddressValidation = async (
    tangleOrder: TransactionOrder,
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
    owner: string,
    request: Record<string, unknown>,
  ) => {
    const params = {
      network: request.network || tangleOrder.network,
      space: request.space,
    };
    const schema = Joi.object(validateAddressSchema);
    await assertValidationAsync(schema, params);

    const order = await createAddressValidationOrder(
      owner,
      params.network as Network,
      params.space as string,
    );
    set(order, 'payload.amount', tranEntry.amount);

    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: order,
      action: 'set',
    });

    if ([Network.IOTA, Network.ATOI].includes(params.network as Network)) {
      return { amount: order.payload.amount, address: order.payload.targetAddress };
    }

    this.transactionService.createUnlockTransaction(
      dayjs().add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
      order,
      tran,
      tranEntry,
      TransactionUnlockType.TANGLE_TRANSFER,
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
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${spaceId}`);
  const space = spaceId ? <Space | undefined>(await spaceDocRef.get()).data() : undefined;
  if (spaceId && !space) {
    throw throwInvalidArgument(WenError.space_does_not_exists);
  }

  if (space) {
    await assertIsGuardian(space.uid, owner);
    if (getAddress(space, network)) {
      throw throwInvalidArgument(WenError.space_already_have_validated_address);
    }
  }

  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();

  const order = <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: space?.uid || null,
    network,
    payload: {
      type: space
        ? TransactionOrderType.SPACE_ADDRESS_VALIDATION
        : TransactionOrderType.MEMBER_ADDRESS_VALIDATION,
      amount: generateRandomAmount(),
      targetAddress: targetAddress.bech32,
      beneficiary: space ? 'space' : 'member',
      beneficiaryUid: space?.uid || owner,
      expiresOn: dateToTimestamp(
        dayjs(serverTime().toDate()).add(TRANSACTION_AUTO_EXPIRY_MS, 'ms'),
      ),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      chainReference: null,
    },
    linkedTransactions: [],
  };
  return order;
};
