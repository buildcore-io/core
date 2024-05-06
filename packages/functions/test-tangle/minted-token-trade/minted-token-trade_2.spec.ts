/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { awaitTransactionConfirmationsForToken } from '../common';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.berforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Fulfill buy with half price', async () => {
    const sellOrder = await helper.createSellTradeOrder();
    const buyOrder = await helper.createBuyOrder(10, 2 * MIN_IOTA_AMOUNT);

    const billPaymentsQuery = database()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .whereIn('member', [helper.seller, helper.buyer]);
    await wait(async () => {
      const snap = await billPaymentsQuery.get();
      return snap.length === 4;
    });

    const billPayments = (await billPaymentsQuery.get()).map((d) => d as Transaction);
    const paymentToSeller = billPayments.find(
      (bp) => bp.payload.targetAddress === helper.sellerAddress!.bech32,
    )!;

    expect(paymentToSeller.payload.amount).toBe(9602600);
    expect(paymentToSeller.payload.sourceAddress).toBe(buyOrder.payload.targetAddress);
    expect(paymentToSeller.payload.storageReturn).toEqual({});

    const royaltyOnePayment = billPayments.find((bp) => bp.payload.amount === 271800)!;
    expect(royaltyOnePayment.payload.storageReturn!.address).toBe(helper.sellerAddress!.bech32);
    expect(royaltyOnePayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress);
    expect(royaltyOnePayment.payload.storageReturn!.amount).toBe(46800);

    const royaltyTwoPayment = billPayments.find((bp) => bp.payload.amount === 71800)!;
    expect(royaltyTwoPayment.payload.storageReturn!.address).toBe(helper.sellerAddress!.bech32);
    expect(royaltyTwoPayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress);
    expect(royaltyTwoPayment.payload.storageReturn!.amount).toBe(46800);

    const paymentToBuyer = billPayments.find(
      (bp) => bp.payload.targetAddress === helper.buyerAddress!.bech32,
    )!;
    expect(paymentToBuyer.payload.amount).toBe(53800);
    expect(paymentToBuyer.payload.nativeTokens![0].amount).toBe(10);
    expect(paymentToBuyer.payload.sourceAddress).toBe(sellOrder.payload.targetAddress);
    expect(paymentToBuyer.payload.storageDepositSourceAddress).toBe(buyOrder.payload.targetAddress);
    expect(paymentToBuyer.payload.storageReturn!.amount).toBe(53800);
    expect(paymentToBuyer.payload.storageReturn!.address).toBe(helper.sellerAddress?.bech32);

    const sellerCreditSnap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(sellerCreditSnap.length).toBe(1);
    const sellerCredit = sellerCreditSnap.map((d) => d as Transaction)[0];
    expect(sellerCredit.payload.amount).toBe(49600);

    const buyerCreditSnap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(buyerCreditSnap.length).toBe(1);
    const buyerCredit = buyerCreditSnap.map((d) => d as Transaction)[0];
    expect(buyerCredit.payload.amount).toBe(10 * MIN_IOTA_AMOUNT);
    expect(buyerCredit.payload.token).toBe(helper.token!.uid);
    expect(buyerCredit.payload.tokenSymbol).toBe(helper.token!.symbol);
    expect(buyerCredit.payload.type).toBe(TransactionPayloadType.TOKEN_TRADE_FULLFILLMENT);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
