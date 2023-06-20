/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  MIN_IOTA_AMOUNT,
  TokenPurchase,
  TokenTradeOrder,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { wait } from '../../test/controls/common';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestMintedTokenFromFaucet } from '../faucet';
import { Helper, VAULT_MNEMONIC } from './Helper';

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

    const billPaymentsQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('member', 'in', [helper.seller, helper.buyer])
      .where('type', '==', TransactionType.BILL_PAYMENT);
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
    expect(paymentToSeller.payload.storageReturn).toBeUndefined();

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
    expect(paymentToBuyer.payload.nativeTokens![0].amount).toBe('10');
    expect(paymentToBuyer.payload.sourceAddress).toBe(sellOrder.payload.targetAddress);
    expect(paymentToBuyer.payload.storageDepositSourceAddress).toBe(buyOrder.payload.targetAddress);
    expect(paymentToBuyer.payload.storageReturn!.amount).toBe(53800);
    expect(paymentToBuyer.payload.storageReturn!.address).toBe(helper.sellerAddress?.bech32);

    const sellerCreditSnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(sellerCreditSnap.length).toBe(1);
    const sellerCredit = sellerCreditSnap.map((d) => d as Transaction)[0];
    expect(sellerCredit.payload.amount).toBe(49600);

    const buyerCreditSnap = await build5Db()
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

  it('Should fulfill low price sell with high price buy', async () => {
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      helper.sellerAddress!,
      helper.token!.mintingData?.tokenId!,
      VAULT_MNEMONIC,
      80,
    );

    await helper.createSellTradeOrder(100, MIN_IOTA_AMOUNT / 100);
    const buyOrder = await helper.createBuyOrder(99, MIN_IOTA_AMOUNT);

    const buyQuery = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('orderTransactionId', '==', buyOrder.uid);
    await wait(async () => {
      const buySnap = await buyQuery.get<TokenTradeOrder>();
      return buySnap[0].fulfilled === 99;
    });
    let buy = (await buyQuery.get())[0] as TokenTradeOrder;
    let purchase = (
      await build5Db().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()
    )[0] as TokenPurchase;
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT / 100);

    const buyOrder2 = await helper.createBuyOrder(1, MIN_IOTA_AMOUNT);
    const buyQuery2 = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('orderTransactionId', '==', buyOrder2.uid);
    await wait(async () => {
      const buySnap = await buyQuery2.get<TokenTradeOrder>();
      return buySnap[0].fulfilled === 1;
    });

    buy = (await buyQuery2.get())[0] as TokenTradeOrder;
    purchase = (
      await build5Db().collection(COL.TOKEN_PURCHASE).where('buy', '==', buy.uid).get()
    )[0] as TokenPurchase;
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
