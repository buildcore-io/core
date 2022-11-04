import { COL, Transaction, TransactionOrder, TransactionType } from '@soonaverse/interfaces';
import { get } from 'lodash';
import admin from '../../admin.config';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from './transaction-service';

export class CreditService {
  constructor(readonly transactionService: TransactionService) {}

  public handleCreditUnrefundableOrder = async (
    order: TransactionOrder,
    match: TransactionMatch,
  ) => {
    const payment = this.transactionService.createPayment(order, match);
    await this.transactionService.markAsReconciled(order, match.msgId);
    const transaction = <Transaction>(
      await admin
        .firestore()
        .doc(`${COL.TRANSACTION}/${get(order, 'payload.transaction', '')}`)
        .get()
    ).data();

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
    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${credit.uid}`),
      data: credit,
      action: 'set',
    });
  };
}
