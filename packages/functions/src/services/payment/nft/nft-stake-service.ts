import {
  COL,
  MilestoneTransactionEntry,
  Network,
  StakeType,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionOrder,
  TransactionOrderType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@build-5/interfaces';
import {
  INftOutput,
  TAG_FEATURE_TYPE,
  TIMELOCK_UNLOCK_CONDITION_TYPE,
  TransactionHelper,
} from '@iota/iota.js-next';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions/v2';
import { cloneDeep, get } from 'lodash';
import { soonDb } from '../../../firebase/firestore/soondb';
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
    let customErrorParams = {};
    try {
      if (!tranEntry.nftOutput) {
        throw WenError.invalid_params;
      }
      const requiredAmount = await this.getNftOutputAmount(order, tranEntry);
      if (requiredAmount > Number(tranEntry.nftOutput.amount)) {
        customErrorParams = { requiredAmount };
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
      const withdrawOrderDocRef = soonDb().doc(`${COL.TRANSACTION}/${withdrawOrder.uid}`);
      this.transactionService.push({
        ref: withdrawOrderDocRef,
        data: withdrawOrder,
        action: 'set',
      });

      const nftDocRef = soonDb().doc(`${COL.NFT}/${nftUpdateData.uid}`);
      this.transactionService.push({
        ref: nftDocRef,
        data: nftUpdateData,
        action: 'update',
      });

      await this.transactionService.createPayment(order, match);
      this.transactionService.markAsReconciled(order, match.msgId);

      const orderDocRef = soonDb().doc(`${COL.TRANSACTION}/${order.uid}`);
      this.transactionService.push({
        ref: orderDocRef,
        data: { 'payload.nft': nft.uid, 'payload.collection': nft.collection },
        action: 'update',
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const payment = await this.transactionService.createPayment(order, match, true);
      this.transactionService.createNftCredit(payment, match, error, customErrorParams);
      functions.logger.error(order.uid, payment.uid, error, customErrorParams);
    }
  };

  private getNftOutputAmount = async (
    order: TransactionOrder,
    tranEntry: MilestoneTransactionEntry,
  ) => {
    const wallet = (await WalletService.newWallet(order.network)) as SmrWallet;
    const weeks = get(order, 'payload.weeks', 0);
    const output = cloneDeep(tranEntry.nftOutput as INftOutput);
    output.features = output.features?.filter((f) => f.type !== TAG_FEATURE_TYPE);
    output.unlockConditions = output.unlockConditions.filter(
      (uc) => uc.type !== TIMELOCK_UNLOCK_CONDITION_TYPE,
    );
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
