import { build5Db } from '@build-5/database';
import {
  COL,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp } from '../../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../../utils/wallet.utils';
import { WalletService } from '../../../wallet/wallet';
import { TransactionService } from '../../transaction-service';

export class NftDepositService {
  constructor(readonly transactionService: TransactionService) {}

  public handleNftDeposit = async (
    network: Network,
    owner: string,
    tran: MilestoneTransaction,
    tranEntry: MilestoneTransactionEntry,
  ) => {
    const wallet = await WalletService.newWallet(network);
    const targetAddress = await wallet.getNewIotaAddressDetails();

    const order = <Transaction>{
      type: TransactionType.ORDER,
      uid: getRandomEthAddress(),
      member: owner,
      space: '',
      network,
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
