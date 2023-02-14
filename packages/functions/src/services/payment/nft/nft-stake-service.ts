import { INftOutput, TIMELOCK_UNLOCK_CONDITION_TYPE, TransactionHelper } from '@iota/iota.js-next';
import {
  COL,
  MilestoneTransactionEntry,
  Network,
  StakeType,
  Transaction,
  TransactionOrder,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  TRANSACTION_AUTO_EXPIRY_MS,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { cloneDeep, get } from 'lodash';
import admin from '../../../admin.config';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { SmrWallet } from '../../wallet/SmrWalletService';
import { WalletService } from '../../wallet/wallet';
import { createNftWithdrawOrder } from '../tangle-service/nft-purchase.service';
import { TransactionMatch, TransactionService } from '../transaction-service';
import { NftDepositService } from './nft-deposit-service';

export class NftStakeService {
  constructor(readonly transactionService: TransactionService) {}

  public handleNftStake = async (
    order: TransactionOrder,
    match: TransactionMatch,
    tranEntry: MilestoneTransactionEntry,
  ) => {
    try {
      if (!tranEntry.nftOutput) {
        throw WenError.invalid_params;
      }
      const requiredAmount = await this.getNftOutputAmount(order, tranEntry);
      if (requiredAmount > Number(tranEntry.nftOutput.amount)) {
        throw WenError.not_enough_base_token;
      }

      const nftDepositService = new NftDepositService(this.transactionService);
      const nft = await nftDepositService.depositNft(order, tranEntry, match);

      const { order: withdrawOrder, nftUpdateData } = createNftWithdrawOrder(
        nft,
        order.member!,
        match.from.address,
        get(order, 'payload.weeks', 0),
        get(order, 'payload.stakeType', StakeType.DYNAMIC),
      );
      const withdrawOrderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${withdrawOrder.uid}`);
      this.transactionService.updates.push({
        ref: withdrawOrderDocRef,
        data: withdrawOrder,
        action: 'set',
      });

      const nftDocRef = admin.firestore().doc(`${COL.NFT}/${nftUpdateData.uid}`);
      this.transactionService.updates.push({
        ref: nftDocRef,
        data: nftUpdateData,
        action: 'update',
      });

      await this.transactionService.createPayment(order, match);
      this.transactionService.markAsReconciled(order, match.msgId);
    } catch (error) {
      const payment = await this.transactionService.createPayment(order, match, true);
      this.transactionService.createNftCredit(
        payment,
        match,
        error as { key: string; code: number },
      );
    }
  };

  private getNftOutputAmount = async (
    order: TransactionOrder,
    tranEntry: MilestoneTransactionEntry,
  ) => {
    const wallet = (await WalletService.newWallet(order.network)) as SmrWallet;
    const weeks = get(order, 'payload.weeks', 0);
    const output = cloneDeep(tranEntry.nftOutput as INftOutput);
    output.unlockConditions.push({
      type: TIMELOCK_UNLOCK_CONDITION_TYPE,
      unixTime: dayjs().add(weeks, 'weeks').unix(),
    });
    return TransactionHelper.getStorageDeposit(output, wallet.info.protocol.rentStructure!);
  };
}

export const createNftStakeOrder = async (
  member: string,
  network: Network,
  weeks: number,
  stakeType: StakeType,
) => {
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  return <Transaction>{
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member,
    space: '',
    network,
    payload: {
      type: TransactionOrderType.STAKE_NFT,
      targetAddress: targetAddress.bech32,
      validationType: TransactionValidationType.ADDRESS,
      expiresOn: dateToTimestamp(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS)),
      reconciled: false,
      void: false,
      weeks,
      stakeType,
    },
  };
};
