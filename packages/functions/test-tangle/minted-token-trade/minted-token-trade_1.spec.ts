/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  BillPaymentType,
  COL,
  MIN_IOTA_AMOUNT,
  TokenPurchase,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
  TransactionCreditType,
  TransactionType,
} from '@build5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
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

  it.each([false, true])('Fulfill trade with same price', async (saveBuyFirst: boolean) => {
    let buyOrder: any;
    let sellOrder: any;
    if (saveBuyFirst) {
      buyOrder = await helper.createBuyOrder();
      sellOrder = await helper.createSellTradeOrder();
    } else {
      sellOrder = await helper.createSellTradeOrder();
      buyOrder = await helper.createBuyOrder();
    }

    const billPaymentsQuery = soonDb()
      .collection(COL.TRANSACTION)
      .where('member', 'in', [helper.seller, helper.buyer])
      .where('type', '==', TransactionType.BILL_PAYMENT);
    await wait(async () => {
      const snap = await billPaymentsQuery.get();
      return snap.length === 4;
    });

    const trades = (
      await soonDb().collection(COL.TOKEN_MARKET).where('token', '==', helper.token!.uid).get()
    ).map((d) => <TokenTradeOrder>d);
    const allHaveTokenStatus = trades.reduce(
      (acc, act) => acc && act.tokenStatus === TokenStatus.MINTED,
      true,
    );
    expect(allHaveTokenStatus).toBe(true);

    const billPayments = (await billPaymentsQuery.get()).map((d) => d as Transaction);

    billPayments.forEach((billPayment) => {
      expect(billPayment.payload.token).toBe(helper.token!.uid);
      expect(billPayment.payload.tokenSymbol).toBe(helper.token!.symbol);
      expect(billPayment.payload.type).toBe(BillPaymentType.MINTED_TOKEN_TRADE);
    });

    const paymentToSeller = billPayments.find(
      (bp) => bp.payload.targetAddress === helper.sellerAddress!.bech32,
    )!;
    expect(paymentToSeller.payload.amount).toBe(9602600);
    expect(paymentToSeller.payload.sourceAddress).toBe(buyOrder.payload.targetAddress);
    expect(paymentToSeller.payload.storageReturn).toBeUndefined();

    const royaltyOnePayment = billPayments.find((bp) => bp.payload.amount === 271800)!;
    expect(royaltyOnePayment.payload.storageReturn.address).toBe(helper.sellerAddress!.bech32);
    expect(royaltyOnePayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress);
    expect(royaltyOnePayment.payload.storageReturn.amount).toBe(46800);

    const royaltyTwoPayment = billPayments.find((bp) => bp.payload.amount === 71800)!;
    expect(royaltyTwoPayment.payload.storageReturn.address).toBe(helper.sellerAddress!.bech32);
    expect(royaltyTwoPayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress);
    expect(royaltyTwoPayment.payload.storageReturn.amount).toBe(46800);

    const paymentToBuyer = billPayments.find(
      (bp) => bp.payload.targetAddress === helper.buyerAddress!.bech32,
    )!;
    expect(paymentToBuyer.payload.amount).toBe(53800);
    expect(paymentToBuyer.payload.nativeTokens[0].amount).toBe(10);
    expect(paymentToBuyer.payload.sourceAddress).toBe(sellOrder.payload.targetAddress);
    expect(paymentToBuyer.payload.storageDepositSourceAddress).toBe(buyOrder.payload.targetAddress);
    expect(paymentToBuyer.payload.storageReturn.amount).toBe(53800);
    expect(paymentToBuyer.payload.storageReturn.address).toBe(helper.sellerAddress?.bech32);

    const sellerCreditSnap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller!)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(sellerCreditSnap.length).toBe(1);
    const sellerCredit = sellerCreditSnap.map((d) => d as Transaction)[0];
    expect(sellerCredit.payload.amount).toBe(49600);
    expect(sellerCredit.payload.token).toBe(helper.token!.uid);
    expect(sellerCredit.payload.tokenSymbol).toBe(helper.token!.symbol);
    expect(sellerCredit.payload.type).toBe(TransactionCreditType.TOKEN_TRADE_FULLFILLMENT);

    const purchase = (
      await soonDb().collection(COL.TOKEN_PURCHASE).where('token', '==', helper.token!.uid).get()
    )[0] as TokenPurchase;
    expect(purchase.triggeredBy).toBe(
      saveBuyFirst ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
    );
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT);
    expect(purchase.count).toBe(10);
    expect(purchase.tokenStatus).toBe(TokenStatus.MINTED);
    expect(purchase.sellerTier).toBe(0);
    expect(purchase.sellerTokenTradingFeePercentage).toBeNull();
    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
