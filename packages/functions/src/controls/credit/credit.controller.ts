import {
  COL,
  DEFAULT_NETWORK,
  Transaction,
  TransactionIgnoreWalletReason,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../database/wrapper/soondb';
import { WalletService } from '../../services/wallet/wallet';
import { throwInvalidArgument } from '../../utils/error.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const creditUnrefundableControl = (owner: string, params: Record<string, unknown>) =>
  soonDb().runTransaction(async (transaction) => {
    const transactionDocRef = soonDb().doc(`${COL.TRANSACTION}/${params.transaction}`);
    const creditTtransaction = await transaction.get<Transaction>(transactionDocRef);

    if (
      creditTtransaction?.ignoreWalletReason !==
      TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION
    ) {
      throw throwInvalidArgument(WenError.can_not_credit_transaction);
    }
    if (creditTtransaction.payload.unlockedBy) {
      throw throwInvalidArgument(WenError.transaction_already_confirmed);
    }

    const wallet = await WalletService.newWallet(creditTtransaction.network);
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const creditOrder = createCreditOrder(creditTtransaction, owner, targetAddress.bech32);
    const creditDocRef = soonDb().doc(`${COL.TRANSACTION}/${creditOrder.uid}`);
    transaction.create(creditDocRef, creditOrder);

    return creditOrder;
  });

const createCreditOrder = (creditTtransaction: Transaction, owner: string, targetAddress: string) =>
  <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member: owner,
    space: creditTtransaction.space,
    network: creditTtransaction.network || DEFAULT_NETWORK,
    payload: {
      type: TransactionOrderType.CREDIT_LOCKED_FUNDS,
      amount: creditTtransaction.payload.amount,
      targetAddress,
      expiresOn: dayjs().add(TRANSACTION_AUTO_EXPIRY_MS).toDate(),
      validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
      reconciled: false,
      void: false,
      transaction: creditTtransaction.uid,
    },
  };
