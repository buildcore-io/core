import { get, isEmpty } from 'lodash';
import { DEFAULT_NETWORK } from '../../../../interfaces/config';
import { Member } from '../../../../interfaces/models';
import { COL } from '../../../../interfaces/models/base';
import { Token, TokenStatus } from '../../../../interfaces/models/token';
import { Transaction, TransactionMintTokenType, TransactionOrder, TransactionType } from '../../../../interfaces/models/transaction';
import admin from '../../../admin.config';
import { getAddress } from '../../../utils/address.utils';
import { serverTime } from "../../../utils/dateTime.utils";
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class TokenMintService {

  constructor(readonly transactionService: TransactionService) { }

  public handleMintingRequest = async (order: TransactionOrder, match: TransactionMatch) => {
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`)
    const token = <Token>(await this.transactionService.transaction.get(tokenDocRef)).data()
    const member = <Member>(await admin.firestore().doc(`${COL.MEMBER}/${order.member}`).get()).data()

    const payment = this.transactionService.createPayment(order, match);
    if (token.status !== TokenStatus.READY_TO_MINT || isEmpty(getAddress(member, order.network!))) {
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
        type: TransactionMintTokenType.MINT_ALIAS,
        amount: get(order, 'payload.aliasStorageDeposit', 0),
        sourceAddress: order.payload.targetAddress,
        targetAddress: getAddress(member, order.network!),
        token: order.payload.token,
        foundryStorageDeposit: get(order, 'payload.foundryStorageDeposit', 0),
        aliasStorageDeposit: get(order, 'payload.aliasStorageDeposit', 0),
        vaultAndGuardianStorageDeposit: get(order, 'payload.vaultAndGuardianStorageDeposit', 0),
        tokensInVault: get(order, 'payload.tokensInVault', 0)
      },
      linkedTransactions: []
    }
    const ref = admin.firestore().doc(`${COL.TRANSACTION}/${data.uid}`)
    this.transactionService.updates.push({ ref, data, action: 'set' });
    this.transactionService.updates.push({ ref: tokenDocRef, data: { status: TokenStatus.MINTING }, action: 'update' });
  }
}
