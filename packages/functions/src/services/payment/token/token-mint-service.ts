import { build5Db } from '@build-5/database';
import { COL, Token, TokenStatus, Transaction, TransactionPayloadType } from '@build-5/interfaces';
import dayjs from 'dayjs';
import { get } from 'lodash';
import { TransactionMatch, TransactionService } from '../transaction-service';

export class TokenMintService {
  constructor(readonly transactionService: TransactionService) {}

  public handleMintingRequest = async (order: Transaction, match: TransactionMatch) => {
    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${order.payload.token}`);
    const token = <Token>await this.transactionService.get(tokenDocRef);

    const payment = await this.transactionService.createPayment(order, match);
    if (![TokenStatus.AVAILABLE, TokenStatus.PRE_MINTED].includes(token.status)) {
      await this.transactionService.createCredit(
        TransactionPayloadType.DATA_NO_LONGER_VALID,
        payment,
        match,
      );
      return;
    }

    if (token.coolDownEnd && dayjs().subtract(1, 'm').isBefore(dayjs(token.coolDownEnd.toDate()))) {
      await this.transactionService.createCredit(
        TransactionPayloadType.DATA_NO_LONGER_VALID,
        payment,
        match,
      );
      return;
    }

    this.transactionService.markAsReconciled(order, match.msgId);

    this.transactionService.push({
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
