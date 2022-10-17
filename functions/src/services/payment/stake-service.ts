import dayjs from 'dayjs';
import { get } from 'lodash';
import { MAX_WEEKS_TO_STAKE } from '../../../interfaces/config';
import {
  Entity,
  Member,
  Transaction,
  TransactionOrder,
  TransactionType,
} from '../../../interfaces/models';
import { COL } from '../../../interfaces/models/base';
import admin from '../../admin.config';
import { getAddress } from '../../utils/address.utils';
import { getStakeTokenId } from '../../utils/config.utils';
import { dateToTimestamp, serverTime } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from './transaction-service';

export class StakeService {
  constructor(readonly transactionService: TransactionService) {}

  public handleStakeOrder = async (order: TransactionOrder, match: TransactionMatch) => {
    const payment = this.transactionService.createPayment(order, match);

    const stakeAmount = Number(
      (match.to.nativeTokens || []).find((nt) => nt.id === getStakeTokenId())?.amount || 0,
    );
    if (
      !stakeAmount ||
      (match.to.nativeTokens || []).length > 1 ||
      match.to.amount < order.payload.amount
    ) {
      this.transactionService.createCredit(payment, match);
      return;
    }
    await this.transactionService.markAsReconciled(order, match.msgId);

    const weeks = get(order, 'payload.weeks', 1);
    const stakedValue = Math.floor(stakeAmount * (1 + weeks / MAX_WEEKS_TO_STAKE));
    const expiresAt = dateToTimestamp(dayjs().add(weeks, 'week').toDate());
    const stake = {
      uid: getRandomEthAddress(),
      member: order.member,
      createdOn: serverTime(),
      space: order.space,
      amount: stakeAmount,
      value: stakedValue,
      weeks,
      expiresAt,
      expirationProcessed: false,
      orderId: order.uid,
    };
    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.STAKE}/${stake.uid}`),
      data: stake,
      action: 'set',
    });
    const member = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${order.member}`).get()).data()
    );
    const billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      member: order.member,
      space: order.space,
      network: order.network,
      payload: {
        amount: match.to.amount,
        nativeTokens: match.to.nativeTokens,
        sourceAddress: order.payload.targetAddress,
        targetAddress: getAddress(member, order.network!),
        previousOwnerEntity: Entity.SPACE,
        previousOwner: order.space,
        ownerEntity: Entity.MEMBER,
        owner: order.member,
        sourceTransaction: [payment.uid],
        royalty: false,
        void: false,
        stake: stake.uid,
        vestingAt: expiresAt,
      },
    };
    this.transactionService.updates.push({
      ref: admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`),
      data: billPayment,
      action: 'set',
    });
  };
}
