import {
  COL,
  CreditUnrefundableRequest,
  DEFAULT_NETWORK,
  IgnoreWalletReason,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../firebase/firestore/build5Db';
import { WalletService } from '../../services/wallet/wallet';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { invalidArgument } from '../../utils/error.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';

export const creditUnrefundableControl = (
  owner: string,
  params: CreditUnrefundableRequest,
): Promise<Transaction> =>
  build5Db().runTransaction(async (transaction) => {
    const transactionDocRef = build5Db().doc(`${COL.TRANSACTION}/${params.transaction}`);
    const creditTransaction = await transaction.get<Transaction>(transactionDocRef);

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

    const wallet = await WalletService.newWallet(creditTransaction.network);
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const creditOrder = createCreditOrder(creditTransaction, owner, targetAddress.bech32);
    const creditDocRef = build5Db().doc(`${COL.TRANSACTION}/${creditOrder.uid}`);
    transaction.create(creditDocRef, creditOrder);

    return creditOrder;
  });

const createCreditOrder = (
  creditTtransaction: Transaction,
  owner: string,
  targetAddress: string,
): Transaction => ({
  type: TransactionType.ORDER,
  uid: getRandomEthAddress(),
  member: owner,
  space: creditTtransaction.space,
  network: creditTtransaction.network || DEFAULT_NETWORK,
  payload: {
    type: TransactionPayloadType.CREDIT_LOCKED_FUNDS,
    amount: creditTtransaction.payload.amount,
    targetAddress,
    expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
    validationType: TransactionValidationType.ADDRESS_AND_AMOUNT,
    reconciled: false,
    void: false,
    transaction: creditTtransaction.uid,
  },
});
