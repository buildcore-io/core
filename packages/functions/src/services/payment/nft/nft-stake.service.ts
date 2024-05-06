import { database } from '@buildcore/database';
import {
  COL,
  MilestoneTransactionEntry,
  Network,
  StakeType,
  TRANSACTION_AUTO_EXPIRY_MS,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  TransactionValidationType,
  WenError,
} from '@buildcore/interfaces';
import {
  FeatureType,
  NftOutput,
  NftOutputBuilderParams,
  TimelockUnlockCondition,
  UnlockConditionType,
  Utils,
} from '@iota/sdk';
import dayjs from 'dayjs';
import { cloneDeep } from 'lodash';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { logger } from '../../../utils/logger';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { WalletService } from '../../wallet/wallet.service';
import { BaseService, HandlerParams } from '../base';
import { createNftWithdrawOrder } from '../tangle-service/nft/nft-purchase.service';
import { Action } from '../transaction-service';
import { NftDepositService } from './nft-deposit.service';

export class NftStakeService extends BaseService {
  public handleRequest = async ({ project, order, match, tranEntry }: HandlerParams) => {
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
        project,
        nft,
        order.member!,
        match.from,
        order.payload.weeks || 0,
        order.payload.stakeType || StakeType.DYNAMIC,
      );
      const withdrawOrderDocRef = database().doc(COL.TRANSACTION, withdrawOrder.uid);
      this.transactionService.push({
        ref: withdrawOrderDocRef,
        data: withdrawOrder,
        action: Action.C,
      });

      const nftDocRef = database().doc(COL.NFT, nft.uid);
      this.transactionService.push({
        ref: nftDocRef,
        data: nftUpdateData,
        action: Action.U,
      });

      await this.transactionService.createPayment(order, match);
      this.transactionService.markAsReconciled(order, match.msgId);

      const orderDocRef = database().doc(COL.TRANSACTION, order.uid);
      this.transactionService.push({
        ref: orderDocRef,
        data: { payload_nft: nft.uid, payload_collection: nft.collection },
        action: Action.U,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const payment = await this.transactionService.createPayment(order, match, true);

      if (tranEntry.nftOutput) {
        this.transactionService.createNftCredit(payment, match, error, customErrorParams);
      } else {
        this.transactionService.createCredit(TransactionPayloadType.DEPOSIT_NFT, payment, match);
      }

      logger.error('nft stake error', order.uid, payment.uid, error, customErrorParams);
    }
  };

  private getNftOutputAmount = async (order: Transaction, tranEntry: MilestoneTransactionEntry) => {
    const wallet = await WalletService.newWallet(order.network);
    const weeks = order.payload.weeks || 0;
    const params: NftOutputBuilderParams = cloneDeep(tranEntry.nftOutput as NftOutput);
    params.features = params.features?.filter(
      (f) => f.type !== FeatureType.Tag && f.type !== FeatureType.Sender,
    );
    params.unlockConditions = params.unlockConditions.filter(
      (uc) => uc.type !== UnlockConditionType.Timelock,
    );
    params.unlockConditions.push(new TimelockUnlockCondition(dayjs().add(weeks, 'weeks').unix()));
    const output = await wallet.client.buildNftOutput(params);
    return Utils.computeStorageDeposit(output, wallet.info.protocol.rentStructure!);
  };
}

export const createNftStakeOrder = async (
  project: string,
  member: string,
  network: Network,
  weeks: number,
  stakeType: StakeType,
): Promise<Transaction> => {
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  return {
    project,
    type: TransactionType.ORDER,
    uid: getRandomEthAddress(),
    member,
    space: '',
    network,
    payload: {
      amount: 0,
      type: TransactionPayloadType.STAKE_NFT,
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
