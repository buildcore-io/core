import { COL, Member, Transaction, TransactionOrder, TransactionType } from '@soon/interfaces';
import { get } from 'lodash';
import admin from '../../admin.config';
import { getAddress } from '../../utils/address.utils';
import { serverTime } from '../../utils/dateTime.utils';
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
    const member = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${order.member}`).get()).data()
    );

    const credit = <Transaction>{
      type: TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED,
      uid: getRandomEthAddress(),
      space: order.space,
      member: order.member,
      createdOn: serverTime(),
      network: order.network,
      payload: {
        amount: order.payload.amount + transaction.payload.amount,
        nativeTokens: transaction.payload.nativeTokens || [],
        sourceAddress: transaction.payload.sourceAddress,
        targetAddress: getAddress(member, order.network!),
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
