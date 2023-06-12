import {
  COL,
  Transaction,
  TransactionCreditType,
  TransactionOrder,
  TransactionType,
} from '@build-5/interfaces';
import { get, isEmpty } from 'lodash';
import { soonDb } from '../../firebase/firestore/soondb';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from './transaction-service';

export class CreditService {
  constructor(readonly transactionService: TransactionService) {}

  public handleCreditUnrefundableOrder = async (
    order: TransactionOrder,
    match: TransactionMatch,
  ) => {
    const payment = await this.transactionService.createPayment(order, match);

    const transactionDocRef = soonDb().doc(
      `${COL.TRANSACTION}/${get(order, 'payload.transaction', '')}`,
    );
    const transaction = <Transaction>await transactionDocRef.get();

    if (!isEmpty(transaction.payload.unlockedBy)) {
      await this.transactionService.createCredit(
        TransactionCreditType.TRANSACTION_ALREADY_UNLOCKED,
        payment,
        match,
      );
      return;
    }

    this.transactionService.markAsReconciled(order, match.msgId);
    const credit = <Transaction>{
      type: TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED,
      uid: getRandomEthAddress(),
      space: order.space,
      member: order.member,
      network: order.network,
      payload: {
        amount: order.payload.amount + transaction.payload.amount,
        nativeTokens: transaction.payload.nativeTokens || [],
        sourceAddress: transaction.payload.sourceAddress,
        targetAddress: transaction.payload.targetAddress,
        sourceTransaction: [payment.uid, ...transaction.payload.sourceTransaction],
        storageDepositSourceAddress: order.payload.targetAddress,
        reconciled: false,
        void: false,
        transaction: transaction.uid,
      },
    };
    this.transactionService.push({
      ref: soonDb().doc(`${COL.TRANSACTION}/${credit.uid}`),
      data: credit,
      action: 'set',
    });

    this.transactionService.push({
      ref: transactionDocRef,
      data: { 'payload.unlockedBy': credit.uid },
      action: 'update',
    });
  };
}
