import {
  COL,
  MIN_IOTA_AMOUNT,
  TokenTradeOrder,
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

  it('Should fulfill sell with two buys', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.seller!.uid, {
      symbol: helper.token!.symbol,
      count: 2 * MIN_IOTA_AMOUNT,
      price: 1,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      sellOrder.payload.targetAddress,
      2 * MIN_IOTA_AMOUNT,
    );

    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      symbol: helper.token!.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 1,
      type: TokenTradeOrderType.BUY,
    });
    const buyOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.targetNetwork,
      buyOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
    );

    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      symbol: helper.token!.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 1,
      type: TokenTradeOrderType.BUY,
    });
    const buyOrder2 = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.targetNetwork,
      buyOrder2.payload.targetAddress,
      MIN_IOTA_AMOUNT,
    );

    const sellQuery = soonDb()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller!.uid);
    await wait(async () => {
      const snap = await sellQuery.get();
      return snap.length === 1;
    });
    const sell = <TokenTradeOrder>(await sellQuery.get())[0];

    const buyQuery = soonDb().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer!.uid);
    await wait(async () => {
      const snap = await buyQuery.get();
      return snap.length === 2;
    });

    const purchaseQuery = soonDb().collection(COL.TOKEN_PURCHASE).where('sell', '==', sell.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length === 2;
    });

    const sellerBillPaymentsSnap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller!.uid)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .get();
    const sellerBillPayments = sellerBillPaymentsSnap.map((d) => d as Transaction);
    expect(sellerBillPayments.filter((p) => p.payload.amount === MIN_IOTA_AMOUNT).length).toBe(2);
    const sellerCreditnap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller!.uid)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(sellerCreditnap.length).toBe(0);

    const buyerBillPaymentsSnap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer!.uid)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .get();
    const buyerBillPayments = buyerBillPaymentsSnap.map((d) => d as Transaction);
    expect(buyerBillPayments.length).toBe(6);
    expect(buyerBillPayments.filter((bp) => bp.payload.amount === 881400).length).toBe(2);
    expect(
      buyerBillPayments.filter(
        (bp) => bp.payload.amount === 69300 && bp.payload.storageReturn.amount === 46800,
      ).length,
    ).toBe(2);
    expect(
      buyerBillPayments.filter(
        (bp) => bp.payload.amount === 49300 && bp.payload.storageReturn.amount === 46800,
      ).length,
    ).toBe(2);
    const buyerCreditnap = await soonDb()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer!.uid)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(buyerCreditnap.length).toBe(0);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
