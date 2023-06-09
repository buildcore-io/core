import {
  COL,
  MilestoneTransaction,
  MilestoneTransactionEntry,
  Network,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionOrderType,
  TransactionType,
  TransactionUnlockType,
  TransactionValidationType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { soonDb } from '../../../../firebase/firestore/soondb';
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
        type: TransactionOrderType.DEPOSIT_NFT,
        targetAddress: targetAddress.bech32,
        validationType: TransactionValidationType.ADDRESS,
        expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
        reconciled: false,
        void: false,
      },
    };
    const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
    this.transactionService.push({ ref: orderDocRef, data: order, action: 'set' });

    this.transactionService.createUnlockTransaction(
      order,
      tran,
      tranEntry,
      TransactionUnlockType.UNLOCK_NFT,
      tranEntry.outputId,
    );
    return;
  };
}