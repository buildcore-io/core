import {
  COL,
  MIN_IOTA_AMOUNT,
  SYSTEM_CONFIG_DOC_ID,
  TokenPurchase,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { tradeToken } from '../../src/controls/token-trading/token-trade.controller';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeAll();
  });

  it.each([false, true])(
    'Should not create royalty payments, zero percentage fee',
    async (isMember: boolean) => {
      if (isMember) {
        await admin
          .firestore()
          .doc(`${COL.MEMBER}/${helper.seller!.uid}`)
          .update({ tokenTradingFeePercentage: 0 });
      } else {
        await admin
          .firestore()
          .doc(`${COL.SYSTEM}/${SYSTEM_CONFIG_DOC_ID}`)
          .set({ tokenTradingFeePercentage: 0 });
      }

      mockWalletReturnValue(helper.walletSpy, helper.seller!.uid, {
        token: helper.token,
        count: MIN_IOTA_AMOUNT,
        price: 2,
        type: TokenTradeOrderType.SELL,
      });
      const sellOrder = await testEnv.wrap(tradeToken)({});
      await requestFundsFromFaucet(
        helper.sourceNetwork,
        sellOrder.payload.targetAddress,
        MIN_IOTA_AMOUNT,
      );

      const tradesQuery = admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('token', '==', helper.token);
      await wait(async () => {
        const snap = await tradesQuery.get();
        return snap.size === 1;
      });

      mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
        token: helper.token,
        count: MIN_IOTA_AMOUNT,
        price: 2,
        type: TokenTradeOrderType.BUY,
      });
      const buyOrder = await testEnv.wrap(tradeToken)({});
      await requestFundsFromFaucet(
        helper.targetNetwork,
        buyOrder.payload.targetAddress,
        2 * MIN_IOTA_AMOUNT,
      );

      const purchaseQuery = admin
        .firestore()
        .collection(COL.TOKEN_PURCHASE)
        .where('token', '==', helper.token);
      await wait(async () => {
        const snap = await purchaseQuery.get();
        return snap.size === 1;
      });

      const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data();
      expect(purchase.price).toBe(2);

      const billPayments = (
        await admin
          .firestore()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.BILL_PAYMENT)
          .where('payload.token', '==', helper.token!)
          .get()
      ).docs.map((d) => <Transaction>d.data());
      expect(billPayments.length).toBe(2);

      const billPaymentToSeller = billPayments.find(
        (bp) =>
          bp.payload.amount === MIN_IOTA_AMOUNT * 2 && bp.payload.owner === helper.seller!.uid,
      );
      expect(billPaymentToSeller).toBeDefined();

      const billPaymentToBuyer = billPayments.find(
        (bp) => bp.payload.amount === MIN_IOTA_AMOUNT && bp.payload.owner === helper.buyer!.uid,
      );
      expect(billPaymentToBuyer).toBeDefined();

      await awaitTransactionConfirmationsForToken(helper.token!);
    },
  );

  it('Should create royalty payments only with dust', async () => {
    await admin
      .firestore()
      .doc(`${COL.MEMBER}/${helper.seller!.uid}`)
      .update({ tokenTradingFeePercentage: 0 });
    mockWalletReturnValue(helper.walletSpy, helper.seller!.uid, {
      token: helper.token,
      count: MIN_IOTA_AMOUNT,
      price: 2,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      sellOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
    );

    const tradesQuery = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('token', '==', helper.token);
    await wait(async () => {
      const snap = await tradesQuery.get();
      return snap.size === 1;
    });

    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      token: helper.token,
      count: MIN_IOTA_AMOUNT,
      price: 2.001,
      type: TokenTradeOrderType.BUY,
    });
    const buyOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.targetNetwork,
      buyOrder.payload.targetAddress,
      2.001 * MIN_IOTA_AMOUNT,
    );

    const purchaseQuery = admin
      .firestore()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.size === 1;
    });

    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data();
    expect(purchase.price).toBe(2);

    const billPayments = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload.token', '==', helper.token!)
        .get()
    ).docs.map((d) => <Transaction>d.data());
    expect(billPayments.length).toBe(3);

    const billPaymentToSpaceOne = billPayments.find((bp) => bp.payload.amount === 1000 + 46800);
    expect(billPaymentToSpaceOne).toBeDefined();

    const billPaymentToSeller = billPayments.find(
      (bp) =>
        bp.payload.amount ===
        MIN_IOTA_AMOUNT * 2 - billPaymentToSpaceOne?.payload?.storageReturn?.amount!,
    );
    expect(billPaymentToSeller).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!);
  });

  it('Should create royalty payments for different percentage', async () => {
    await admin
      .firestore()
      .doc(`${COL.MEMBER}/${helper.seller!.uid}`)
      .update({ tokenTradingFeePercentage: 1 });
    mockWalletReturnValue(helper.walletSpy, helper.seller!.uid, {
      token: helper.token,
      count: MIN_IOTA_AMOUNT,
      price: 2,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      sellOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
    );

    const tradesQuery = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('token', '==', helper.token);
    await wait(async () => {
      const snap = await tradesQuery.get();
      return snap.size === 1;
    });

    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      token: helper.token,
      count: MIN_IOTA_AMOUNT,
      price: 2,
      type: TokenTradeOrderType.BUY,
    });
    const buyOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.targetNetwork,
      buyOrder.payload.targetAddress,
      2 * MIN_IOTA_AMOUNT,
    );

    const purchaseQuery = admin
      .firestore()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.size === 1;
    });

    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data();
    expect(purchase.price).toBe(2);

    const billPayments = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload.token', '==', helper.token!)
        .get()
    ).docs.map((d) => <Transaction>d.data());
    expect(billPayments.length).toBe(4);

    const billPaymentToSpaceOne = billPayments.find(
      (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 2 * 0.01 * 0.1 + 46800,
    );
    expect(billPaymentToSpaceOne).toBeDefined();

    const billPaymentToSpaceTwo = billPayments.find(
      (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 2 * 0.01 * 0.9 + 46800,
    );
    expect(billPaymentToSpaceTwo).toBeDefined();

    const billPaymentToSeller = billPayments.find(
      (bp) =>
        bp.payload.amount ===
        MIN_IOTA_AMOUNT * 2 * 0.99 -
          billPaymentToSpaceOne?.payload?.storageReturn?.amount! -
          billPaymentToSpaceTwo?.payload?.storageReturn?.amount!,
    );
    expect(billPaymentToSeller).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!);
  });
});
