import { build5Db } from '@build-5/database';
import {
  COL,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { getProject } from '../../../../utils/common.utils';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet.service';
import { BaseService, HandlerParams } from '../../base';

export class NftDepositService extends BaseService {
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
    const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
    this.transactionService.push({ ref: orderDocRef, data: order, action: 'set' });

    this.transactionService.createUnlockTransaction(
      order,
      tran,
      tranEntry,
      TransactionPayloadType.UNLOCK_NFT,
      tranEntry.outputId,
    );
    return;
  };
}
