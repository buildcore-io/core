import { build5Db } from '@build-5/database';
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
} from '@build-5/interfaces';
import {
  FeatureType,
  NftOutput,
  NftOutputBuilderParams,
  TimelockUnlockCondition,
  UnlockConditionType,
  Utils,
} from '@iota/sdk';
import dayjs from 'dayjs';
import { cloneDeep, get } from 'lodash';
import { intToU32 } from '../../../utils/common.utils';
import { dateToTimestamp } from '../../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../../utils/wallet.utils';
import { WalletService } from '../../wallet/wallet.service';
import { createNftWithdrawOrder } from '../tangle-service/nft/nft-purchase.service';
import { TransactionMatch, TransactionService } from '../transaction-service';
import { NftDepositService } from './nft-deposit-service';
export class NftStakeService {
  constructor(readonly transactionService: TransactionService) {}

  public handleNftStake = async (
    order: Transaction,
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
        match.from,
        get(order, 'payload.weeks', 0),
        get(order, 'payload.stakeType', StakeType.DYNAMIC),
      );
      const withdrawOrderDocRef = build5Db().doc(`${COL.TRANSACTION}/${withdrawOrder.uid}`);
      this.transactionService.push({
        ref: withdrawOrderDocRef,
        data: withdrawOrder,
        action: 'set',
      });

      const nftDocRef = build5Db().doc(`${COL.NFT}/${nftUpdateData.uid}`);
      this.transactionService.push({
        ref: nftDocRef,
        data: nftUpdateData,
        action: 'update',
      });

      await this.transactionService.createPayment(order, match);
      this.transactionService.markAsReconciled(order, match.msgId);

      const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
      this.transactionService.push({
        ref: orderDocRef,
        data: { 'payload.nft': nft.uid, 'payload.collection': nft.collection },
        action: 'update',
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const payment = await this.transactionService.createPayment(order, match, true);
      this.transactionService.createNftCredit(payment, match, error, customErrorParams);
      console.error(order.uid, payment.uid, error, customErrorParams);
    }
  };

  private getNftOutputAmount = async (order: Transaction, tranEntry: MilestoneTransactionEntry) => {
    const wallet = await WalletService.newWallet(order.network);
    const weeks = get(order, 'payload.weeks', 0);
    const params: NftOutputBuilderParams = cloneDeep(tranEntry.nftOutput as NftOutput);
    params.features = params.features?.filter((f) => f.type !== FeatureType.Tag);
    params.unlockConditions = params.unlockConditions.filter(
      (uc) => uc.type !== UnlockConditionType.Timelock,
    );
    params.unlockConditions.push(
      new TimelockUnlockCondition(intToU32(dayjs().add(weeks, 'weeks').unix())),
    );
    const output = await wallet.client.buildNftOutput(params);
    return Utils.computeStorageDeposit(output, wallet.info.protocol.rentStructure!);
  };
}

export const createNftStakeOrder = async (
  member: string,
  network: Network,
  weeks: number,
  stakeType: StakeType,
): Promise<Transaction> => {
  const wallet = await WalletService.newWallet(network);
  const targetAddress = await wallet.getNewIotaAddressDetails();
  return {
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
