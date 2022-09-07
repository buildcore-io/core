import { DEFAULT_NETWORK } from '../../../../interfaces/config';
import { COL } from '../../../../interfaces/models/base';
import { Token, TokenStatus } from '../../../../interfaces/models/token';
import { Transaction, TransactionOrder, TransactionType } from '../../../../interfaces/models/transaction';
import admin from '../../../admin.config';
import { serverTime } from "../../../utils/dateTime.utils";
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class TokenMintService {

  constructor(readonly transactionService: TransactionService) { }

  public handleMintingRequest = async (order: TransactionOrder, match: TransactionMatch) => {
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`)
    const token = <Token>(await this.transactionService.transaction.get(tokenDocRef)).data()

    const payment = this.transactionService.createPayment(order, match);
    if (token.status !== TokenStatus.READY_TO_MINT) {
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId)

    const data = <Transaction>{
      type: TransactionType.MINT_TOKEN,
      uid: getRandomEthAddress(),
      member: order.member,
      space: token!.space,
      createdOn: serverTime(),
      network: order.network || DEFAULT_NETWORK,
      payload: {
        amount: order.payload.amount,
        sourceAddress: order.payload.targetAddress,
        reconciled: false,
        void: false,
        token: order.payload.token
      },
      linkedTransactions: []
    }
    const ref = admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`)
    this.transactionService.updates.push({ ref, data, action: 'set' });
  }
}
