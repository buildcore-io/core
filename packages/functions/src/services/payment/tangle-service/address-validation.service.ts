import {
  COL,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  Space,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionOrder,
  TransactionOrderType,
  TransactionType,
  TransactionUnlockType,
  TransactionValidationType,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { set } from 'lodash';
import { soonDb } from '../../../firebase/firestore/soondb';
import { validateAddressSchema } from '../../../runtime/firebase/address';
import { generateRandomAmount } from '../../../utils/common.utils';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { invalidArgument } from '../../../utils/error.utils';
import { assertValidationAsync } from '../../../utils/schema.utils';
import { hasActiveEditProposal } from '../../../utils/space.utils';
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
    await assertValidationAsync(validateAddressSchema, params);

    const order = await createAddressValidationOrder(
      owner,
      params.network as Network,
      params.space as string,
    );
    set(order, 'payload.amount', tranEntry.amount);

    this.transactionService.push({
      ref: soonDb().doc(`${COL.TRANSACTION}/${order.uid}`),
      data: order,
      action: 'set',
    });

    if ([Network.IOTA, Network.ATOI].includes(params.network as Network)) {
      return { amount: order.payload.amount, address: order.payload.targetAddress };
    }

    this.transactionService.createUnlockTransaction(
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
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${spaceId}`);
  const space = spaceId ? <Space | undefined>await spaceDocRef.get() : undefined;
  if (spaceId && !space) {
    throw invalidArgument(WenError.space_does_not_exists);
  }

  if (space) {
    await assertIsGuardian(space.uid, owner);
    if (await hasActiveEditProposal(space.uid)) {
      throw invalidArgument(WenError.ongoing_proposal);
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
