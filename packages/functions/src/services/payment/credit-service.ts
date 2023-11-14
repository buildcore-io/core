import { build5Db } from '@build-5/database';
import { COL, Transaction, TransactionPayloadType, TransactionType } from '@build-5/interfaces';
import { get, isEmpty } from 'lodash';
import { getProject } from '../../utils/common.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { BaseService, HandlerParams } from './base';

export class CreditService extends BaseService {
  public handleRequest = async ({ order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);

    const transactionDocRef = build5Db().doc(
      `${COL.TRANSACTION}/${get(order, 'payload.transaction', '')}`,
    );
    const transaction = <Transaction>await transactionDocRef.get();

    if (!isEmpty(transaction.payload.unlockedBy)) {
      await this.transactionService.createCredit(
        TransactionPayloadType.TRANSACTION_ALREADY_UNLOCKED,
        payment,
        match,
      );
      return;
    }

    this.transactionService.markAsReconciled(order, match.msgId);
    const credit: Transaction = {
      project: getProject(order),
      type: TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED,
      uid: getRandomEthAddress(),
      space: order.space,
      member: order.member,
      network: order.network,
      payload: {
        amount: order.payload.amount! + transaction.payload.amount!,
        nativeTokens: transaction.payload.nativeTokens || [],
        sourceAddress: transaction.payload.sourceAddress,
        targetAddress: transaction.payload.targetAddress,
        sourceTransaction: [payment.uid, ...transaction.payload.sourceTransaction!],
        storageDepositSourceAddress: order.payload.targetAddress,
        reconciled: false,
        void: false,
        transaction: transaction.uid,
      },
    };
    this.transactionService.push({
      ref: build5Db().doc(`${COL.TRANSACTION}/${credit.uid}`),
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
