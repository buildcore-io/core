import {
  COL,
  MIN_IOTA_AMOUNT,
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

  it('Should not fill buy, dust and order not fulfilled', async () => {
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

    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      token: helper.token,
      count: MIN_IOTA_AMOUNT + 1,
      price: 2,
      type: TokenTradeOrderType.BUY,
    });
    const buyOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.targetNetwork,
      buyOrder.payload.targetAddress,
      2 * (MIN_IOTA_AMOUNT + 1),
    );

    const tradesQuery = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('token', '==', helper.token);
    await wait(async () => {
      const snap = await tradesQuery.get();
      return snap.size === 2;
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const purchase = await admin
      .firestore()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token)
      .get();
    expect(purchase.size).toBe(0);

    await awaitTransactionConfirmationsForToken(helper.token!);
  });

  it('Should send dust to space', async () => {
    const tradesQuery = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('token', '==', helper.token);
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

    const billPaymentToSpaceOne = billPayments.find(
      (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 2 * 0.025 * 0.1 + 1000 + 46800,
    );
    expect(billPaymentToSpaceOne).toBeDefined();

    const billPaymentToSpaceTwo = billPayments.find(
      (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 2 * 0.025 * 0.9 + 46800,
    );
    expect(billPaymentToSpaceTwo).toBeDefined();

    const billPaymentToSeller = billPayments.find(
      (bp) =>
        bp.payload.amount ===
        MIN_IOTA_AMOUNT * 2 * 0.975 -
          billPaymentToSpaceOne?.payload?.storageReturn?.amount! -
          billPaymentToSpaceTwo?.payload?.storageReturn?.amount!,
    );
    expect(billPaymentToSeller).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!);
  });
});
