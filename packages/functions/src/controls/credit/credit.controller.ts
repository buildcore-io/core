import { database } from '@buildcore/database';
import {
  COL,
  CreditUnrefundableRequest,
  DEFAULT_NETWORK,
  IgnoreWalletReason,
  NetworkAddress,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { WalletService } from '../../services/wallet/wallet.service';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { Context } from '../common';

export const creditUnrefundableControl = ({
  owner,
  params,
  project,
}: Context<CreditUnrefundableRequest>): Promise<Transaction> =>
  database().runTransaction(async (transaction) => {
    const transactionDocRef = database().doc(COL.TRANSACTION, params.transaction);
    const creditTransaction = await transaction.get(transactionDocRef);

    if (
      !creditTransaction ||
      creditTransaction?.ignoreWalletReason !==
        IgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION
    ) {
      throw invalidArgument(WenError.can_not_credit_transaction);
    }

    if (creditTransaction.payload.unlockedBy) {
      throw invalidArgument(WenError.transaction_already_confirmed);
    }

    const expiresOn = creditTransaction.payload.expiresOn;
    if (expiresOn && dayjs(expiresOn.toDate()).isBefore(dayjs())) {
      throw invalidArgument(WenError.credit_has_expired);
    }

    const wallet = await WalletService.newWallet(creditTransaction.network);
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const creditOrder = createCreditOrder(project, creditTransaction, owner, targetAddress.bech32);
    const creditDocRef = database().doc(COL.TRANSACTION, creditOrder.uid);
    await transaction.create(creditDocRef, creditOrder);

    return creditOrder;
  });

const createCreditOrder = (
  project: string,
  creditTtransaction: Transaction,
  owner: string,
  targetAddress: NetworkAddress,
): Transaction => {
  const defaultExpiresOn = dayjs().add(TRANSACTION_AUTO_EXPIRY_MS);
  const creditExpiresOn = dayjs(creditTtransaction.payload.expiresOn?.toDate() || defaultExpiresOn);
  return {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: creditTtransaction.space,
    network: creditTtransaction.network || DEFAULT_NETWORK,
    payload: {
      type: TransactionPayloadType.CREDIT_LOCKED_FUNDS,
      amount: creditTtransaction.payload.amount,
      targetAddress,
      expiresOn: creditExpiresOn.isBefore(defaultExpiresOn)
        ? dateToTimestamp(creditExpiresOn)
        : dateToTimestamp(defaultExpiresOn),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      transaction: creditTtransaction.uid,
    },
  };
};
