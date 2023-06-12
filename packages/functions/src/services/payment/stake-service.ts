import {
  BillPaymentType,
  calcStakedMultiplier,
  COL,
  Entity,
  Stake,
  StakeType,
  Token,
  Transaction,
  TransactionCreditType,
  TransactionOrder,
  TransactionType,
} from '@build5/interfaces';
import dayjs from 'dayjs';
import { get } from 'lodash';
import { soonDb } from '../../firebase/firestore/soondb';
import { dateToTimestamp } from '../../utils/dateTime.utils';
import { getRandomEthAddress } from '../../utils/wallet.utils';
import { TransactionMatch, TransactionService } from './transaction-service';

export class StakeService {
  constructor(readonly transactionService: TransactionService) {}

  public handleStakeOrder = async (order: TransactionOrder, match: TransactionMatch) => {
    const payment = await this.transactionService.createPayment(order, match);

    const matchAmount = match.to.amount;
    const nativeTokens = (match.to.nativeTokens || []).map((nt) => ({
      ...nt,
      amount: Number(nt.amount),
    }));
    const tokenId = get(order, 'payload.tokenId', '');
    const stakeAmount = Number(nativeTokens.find((nt) => nt.id === tokenId)?.amount || 0);

    if (!stakeAmount || nativeTokens.length > 1 || matchAmount < order.payload.amount) {
      await this.transactionService.createCredit(
        TransactionCreditType.INVALID_AMOUNT,
        payment,
        match,
      );
      return;
    }
    this.transactionService.markAsReconciled(order, match.msgId);

    const weeks = get(order, 'payload.weeks', 1);
    const stakedValue = Math.floor(stakeAmount * calcStakedMultiplier(weeks));
    const expiresAt = dateToTimestamp(dayjs().add(weeks, 'week').toDate());

    const tokenUid = get(order, 'payload.token', '');
    const tokenDocRef = soonDb().doc(`${COL.TOKEN}/${tokenUid}`);
    const token = <Token>await tokenDocRef.get();

    const billPayment = <Transaction>{
      type: TransactionType.BILL_PAYMENT,
      uid: getRandomEthAddress(),
      member: order.member,
      space: order.space,
      network: order.network,
      payload: {
        type: BillPaymentType.STAKE,
        amount: matchAmount,
        nativeTokens,
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
        token: token!.uid,
        tokenSymbol: token!.symbol,
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
    };
    billPayment.payload.stake = stake.uid;

    this.transactionService.push({
      ref: soonDb().doc(`${COL.STAKE}/${stake.uid}`),
      data: stake,
      action: 'set',
    });

    this.transactionService.push({
      ref: soonDb().doc(`${COL.TRANSACTION}/${billPayment.uid}`),
      data: billPayment,
      action: 'set',
    });
  };
}
