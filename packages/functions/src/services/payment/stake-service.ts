import {
  calcStakedMultiplier,
  COL,
  Entity,
  Stake,
  StakeType,
  Transaction,
  TransactionOrder,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { get } from 'lodash';
import admin from '../../admin.config';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from './transaction-service';

export class StakeService {
  constructor(readonly transactionService: TransactionService) {}

  public handleStakeOrder = async (order: TransactionOrder, match: TransactionMatch) => {
    const payment = this.transactionService.createPayment(order, match);

    const matchAmount = match.to.amount;
    const nativeTokens = match.to.nativeTokens || [];
    const tokenId = get(order, 'payload.tokenId', '');
    const stakeAmount = Number(nativeTokens.find((nt) => nt.id === tokenId)?.amount || 0);

    if (!stakeAmount || nativeTokens.length > 1 || matchAmount < order.payload.amount) {
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId);

    const weeks = get(order, 'payload.weeks', 1);
    const stakedValue = Math.floor(stakeAmount * calcStakedMultiplier(weeks));
    const expiresAt = dateToTimestamp(dayjs().add(weeks, 'week').toDate());

    const billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      member: order.member,
      space: order.space,
      network: order.network,
      payload: {
        amount: matchAmount,
        nativeTokens: nativeTokens,
        sourceAddress: order.payload.targetAddress,
        targetAddress: match.from.address,
        previousOwnerEntity: Entity.MEMBER,
        previousOwner: order.member,
        ownerEntity: Entity.MEMBER,
        owner: order.member,
        sourceTransaction: [payment.uid],
        royalty: false,
        void: false,
        vestingAt: expiresAt,
        customMetadata: get(order, 'payload.customMetadata', {}),
        token: order.payload.token,
      },
    };

    const stake: Stake = {
      uid: getRandomEthAddress(),
      member: order.member!,
      token: order.payload.token!,
      type: get(order, 'payload.stakeType', StakeType.DYNAMIC),
      space: order.space!,
      amount: stakeAmount,
      value: stakedValue,
      weeks,
      expiresAt,
      expirationProcessed: false,
      orderId: order.uid,
      billPaymentId: billPayment.uid,
      customMetadata: get(order, 'payload.customMetadata', {}),
      leftCheck: dayjs(expiresAt.toDate()).valueOf(),
      rightCheck: dayjs().valueOf(),
    };
    billPayment.payload.stake = stake.uid;

    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.STAKE}/${stake.uid}`),
      data: stake,
      action: 'set',
    });

    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`),
      data: billPayment,
      action: 'set',
    });
  };
}
