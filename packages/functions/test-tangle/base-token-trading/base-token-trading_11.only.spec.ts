import {
  COL,
  MIN_IOTA_AMOUNT,
  StakeType,
  SUB_COL,
  SYSTEM_CONFIG_DOC_ID,
  TokenPurchase,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { tradeToken } from '../../src/runtime/firebase/token/trading';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it.each([false, true])(
    'Should not create royalty payments, zero percentage fee',
    async (isMember: boolean) => {
      if (isMember) {
        await soonDb()
          .doc(`${COL.MEMBER}/${helper.seller!.uid}`)
          .update({ tokenTradingFeePercentage: 0 });
        await soonDb()
          .collection(COL.TOKEN)
          .doc(helper.soonTokenId)
          .collection(SUB_COL.DISTRIBUTION)
          .doc(helper.seller?.uid!)
          .set(
            {
              stakes: {
                [StakeType.DYNAMIC]: {
                  value: 15000 * MIN_IOTA_AMOUNT,
                },
              },
            },
            true,
          );
      } else {
        await soonDb()
          .doc(`${COL.SYSTEM}/${SYSTEM_CONFIG_DOC_ID}`)
          .set({ tokenTradingFeePercentage: 0 });
      }

      mockWalletReturnValue(helper.walletSpy, helper.seller!.uid, {
        symbol: helper.token!.symbol,
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

      const tradesQuery = soonDb()
        .collection(COL.TOKEN_MARKET)
        .where('token', '==', helper.token!.uid);
      await wait(async () => {
        const snap = await tradesQuery.get();
        return snap.length === 1;
      });

      mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
        symbol: helper.token!.symbol,
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

      const purchaseQuery = soonDb()
        .collection(COL.TOKEN_PURCHASE)
        .where('token', '==', helper.token!.uid);
      await wait(async () => {
        const snap = await purchaseQuery.get();
        return snap.length === 1;
      });

      const purchase = <TokenPurchase>(await purchaseQuery.get())[0];
      expect(purchase.price).toBe(2);
      if (isMember) {
        expect(purchase.sellerTier).toBe(4);
        expect(purchase.sellerTokenTradingFeePercentage).toBe(0);
      }

      const billPayments = (
        await soonDb()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.BILL_PAYMENT)
          .where('payload.token', '==', helper.token!.uid)
          .get()
      ).map((d) => <Transaction>d);
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

      await awaitTransactionConfirmationsForToken(helper.token!.uid);
    },
  );

  it('Should create royalty payments only with dust', async () => {
    await soonDb()
      .doc(`${COL.MEMBER}/${helper.seller!.uid}`)
      .update({ tokenTradingFeePercentage: 0 });
    mockWalletReturnValue(helper.walletSpy, helper.seller!.uid, {
      symbol: helper.token!.symbol,
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

    const tradesQuery = soonDb()
      .collection(COL.TOKEN_MARKET)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await tradesQuery.get();
      return snap.length === 1;
    });

    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      symbol: helper.token!.symbol,
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

    const purchaseQuery = soonDb()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length === 1;
    });

    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];
    expect(purchase.price).toBe(2);

    const billPayments = (
      await soonDb()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload.token', '==', helper.token!.uid)
        .get()
    ).map((d) => <Transaction>d);
    expect(billPayments.length).toBe(3);

    const billPaymentToSpaceOne = billPayments.find((bp) => bp.payload.amount === 1000 + 46800);
    expect(billPaymentToSpaceOne).toBeDefined();

    const billPaymentToSeller = billPayments.find(
      (bp) =>
        bp.payload.amount ===
        MIN_IOTA_AMOUNT * 2 - billPaymentToSpaceOne?.payload?.storageReturn?.amount!,
    );
    expect(billPaymentToSeller).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });

  it('Should create royalty payments for different percentage', async () => {
    await soonDb()
      .doc(`${COL.MEMBER}/${helper.seller!.uid}`)
      .update({ tokenTradingFeePercentage: 1 });
    mockWalletReturnValue(helper.walletSpy, helper.seller!.uid, {
      symbol: helper.token!.symbol,
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

    const tradesQuery = soonDb()
      .collection(COL.TOKEN_MARKET)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await tradesQuery.get();
      return snap.length === 1;
    });

    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      symbol: helper.token!.symbol,
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

    const purchaseQuery = soonDb()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length === 1;
    });

    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];
    expect(purchase.price).toBe(2);

    const billPayments = (
      await soonDb()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload.token', '==', helper.token!.uid)
        .get()
    ).map((d) => <Transaction>d);
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

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
