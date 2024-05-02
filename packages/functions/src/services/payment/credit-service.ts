import { database } from '@buildcore/database';
import { COL, Transaction, TransactionPayloadType, TransactionType } from '@buildcore/interfaces';
import { isEmpty } from 'lodash';
import { getProject } from '../../utils/common.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { BaseService, HandlerParams } from './base';
import { Action } from './transaction-service';

export class CreditService extends BaseService {
  public handleRequest = async ({ order, match }: HandlerParams) => {
    const payment = await this.transactionService.createPayment(order, match);

    const transactionDocRef = database().doc(COL.TRANSACTION, order.payload.transaction || '');
    const transaction = <Transaction>await this.transaction.get(transactionDocRef);

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
      ref: database().doc(COL.TRANSACTION, credit.uid),
      data: credit,
      action: Action.C,
    });

    this.transactionService.push({
      ref: transactionDocRef,
      data: { payload_unlockedBy: credit.uid },
      action: Action.U,
    });
  };
}
