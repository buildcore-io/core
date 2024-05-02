import { database } from '@buildcore/database';
import { COL, Token, TokenStatus, TransactionPayloadType } from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { BaseService, HandlerParams } from '../base';
import { Action } from '../transaction-service';

export class TokenMintService extends BaseService {
  public handleRequest = async ({ order, match }: HandlerParams) => {
    const tokenDocRef = database().doc(COL.TOKEN, order.payload.token!);
    const token = <Token>await this.transaction.get(tokenDocRef);

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
        mintingData_mintedBy: order.member,
        mintingData_network: order.network,
        mintingData_aliasStorageDeposit: order.payload.aliasStorageDeposit || 0,
        mintingData_foundryStorageDeposit: order.payload.foundryStorageDeposit || 0,
        mintingData_vaultStorageDeposit: order.payload.vaultStorageDeposit || 0,
        mintingData_guardianStorageDeposit: order.payload.guardianStorageDeposit || 0,
        mintingData_tokensInVault: order.payload.tokensInVault || 0,
        mintingData_vaultAddress: order.payload.targetAddress,
      },
      action: Action.U,
    });
  };
}
