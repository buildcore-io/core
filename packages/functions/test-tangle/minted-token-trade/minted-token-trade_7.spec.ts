/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  CreditPaymentReason,
  MIN_IOTA_AMOUNT,
  TokenTradeOrder,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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

  it('Half fulfill sell and cancel it', async () => {
    const sellOrder = await helper.createSellTradeOrder();
    const buyOrder = await helper.createBuyOrder(5, MIN_IOTA_AMOUNT);

    const query = database().collection(COL.TOKEN_MARKET).where('owner', '==', helper.seller);
    await wait(async () => {
      const orders = (await query.get()).map((d) => <TokenTradeOrder>d);
      return orders.length === 1 && orders[0].fulfilled === 5;
    });
    await awaitTransactionConfirmationsForToken(helper.token!.uid);

    const sell = <TokenTradeOrder>(await query.get())[0];
    mockWalletReturnValue(helper.seller!, { uid: sell.uid });
    await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.cancelTradeOrder);

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
    expect(paymentToSeller.payload.amount).toBe(4727600);
    expect(paymentToSeller.payload.sourceAddress).toBe(buyOrder.payload.targetAddress);
    expect(paymentToSeller.payload.storageReturn).toEqual({});

    const royaltyOnePayment = billPayments.find((bp) => bp.payload.amount === 159300)!;
    expect(royaltyOnePayment.payload.storageReturn!.address).toBe(helper.sellerAddress!.bech32);
    expect(royaltyOnePayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress);
    expect(royaltyOnePayment.payload.storageReturn!.amount).toBe(46800);

    const royaltyTwoPayment = billPayments.find((bp) => bp.payload.amount === 59300)!;
    expect(royaltyTwoPayment.payload.storageReturn!.address).toBe(helper.sellerAddress!.bech32);
    expect(royaltyTwoPayment.payload.sourceAddress).toBe(buyOrder.payload.targetAddress);
    expect(royaltyTwoPayment.payload.storageReturn!.amount).toBe(46800);

    const paymentToBuyer = billPayments.find(
      (bp) => bp.payload.targetAddress === helper.buyerAddress!.bech32,
    )!;
    expect(paymentToBuyer.payload.amount).toBe(53800);
    expect(paymentToBuyer.payload.nativeTokens![0].amount).toBe(5);
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
    expect(sellerCredit.payload.nativeTokens![0].amount).toBe(5);
    expect(sellerCredit.payload.reason).toBe(CreditPaymentReason.TRADE_CANCELLED);

    const buyerCreditSnap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(buyerCreditSnap.length).toBe(0);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
