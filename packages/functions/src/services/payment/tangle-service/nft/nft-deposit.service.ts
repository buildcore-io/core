import { database } from '@buildcore/database';
import {
  COL,
  TRANSACTION_AUTO_EXPIRY_MS,
  TangleResponse,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { getProject } from '../../../../utils/common.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseTangleService, HandlerParams } from '../../base';
import { Action } from '../../transaction-service';

export class NftDepositService extends BaseTangleService<TangleResponse> {
  public handleRequest = async ({ owner, tran, tranEntry, ...params }: HandlerParams) => {
    const wallet = await WalletService.newWallet(params.order.network);
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const order: Transaction = {
      project: getProject(params.order),
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: owner,
      space: '',
      network: params.order.network,
      payload: {
        type: TransactionPayloadType.DEPOSIT_NFT,
        targetAddress: targetAddress.bech32,
        validationType: TransactionValidationType.ADDRESS,
        expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
        reconciled: false,
        void: false,
      },
    };
    const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
    this.transactionService.push({ ref: orderDocRef, data: order, action: Action.C });

    this.transactionService.createUnlockTransaction(
      params.payment,
      order,
      tran,
      tranEntry,
      TransactionPayloadType.UNLOCK_NFT,
      tranEntry.outputId,
    );

    return {};
  };
}
