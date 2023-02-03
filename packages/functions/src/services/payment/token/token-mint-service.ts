import { COL, Token, TokenStatus, TransactionOrder } from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { get } from 'lodash';
import admin from '../../../admin.config';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class TokenMintService {
  constructor(readonly transactionService: TransactionService) {}

  public handleMintingRequest = async (order: TransactionOrder, match: TransactionMatch) => {
    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${order.payload.token}`);
    const token = <Token>(await this.transactionService.transaction.get(tokenDocRef)).data();

    const payment = this.transactionService.createPayment(order, match);
    if (![TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED].includes(token.status)) {
      this.transactionService.createCredit(payment, match);
      return;
    }

    if (token.coolDownEnd && dayjs().subtract(1, 'm').isBefore(dayjs(token.coolDownEnd.toDate()))) {
      this.transactionService.createCredit(payment, match);
      return;
    }

    this.transactionService.markAsReconciled(order, match.msgId);

    this.transactionService.updates.push({
      ref: tokenDocRef,
      data: {
        status: TokenStatus.MINTING,
        'mintingData.mintedBy': order.member,
        'mintingData.network': order.network,
        'mintingData.aliasStorageDeposit': get(order, 'payload.aliasStorageDeposit', 0),
        'mintingData.foundryStorageDeposit': get(order, 'payload.foundryStorageDeposit', 0),
        'mintingData.vaultStorageDeposit': get(order, 'payload.vaultStorageDeposit', 0),
        'mintingData.guardianStorageDeposit': get(order, 'payload.guardianStorageDeposit', 0),
        'mintingData.tokensInVault': get(order, 'payload.tokensInVault', 0),
        'mintingData.vaultAddress': order.payload.targetAddress,
      },
      action: 'update',
    });
  };
}
