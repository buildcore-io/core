import {
  COL,
  MIN_IOTA_AMOUNT,
  Timestamp,
  TokenPurchase,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import admin from '../../src/admin.config';
import { tradeToken } from '../../src/controls/token-trading/token-trade.controller';
import { getAddress } from '../../src/utils/address.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { getWallet, testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should fulfill sell order', async () => {
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

    const sellQuery = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller!.uid);
    await wait(async () => {
      const snap = await sellQuery.get();
      return snap.size !== 0;
    });

    const sell = <TokenTradeOrder>(await sellQuery.get()).docs[0].data();
    expect(sell.tokenStatus).toBe(TokenStatus.BASE);

    const buyQuery = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.buyer!.uid);
    await wait(async () => {
      const snap = await buyQuery.get();
      return snap.size !== 0;
    });
    const buy = <TokenTradeOrder>(await buyQuery.get()).docs[0].data();
    expect(buy.tokenStatus).toBe(TokenStatus.BASE);

    const purchaseQuery = admin
      .firestore()
      .collection(COL.TOKEN_PURCHASE)
      .where('sell', '==', sell.uid)
      .where('buy', '==', buy.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.size !== 0;
    });
    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data();

    expect(purchase.count).toBe(MIN_IOTA_AMOUNT);
    expect(purchase.price).toBe(2);
    expect(purchase.sourceNetwork).toBe(helper.sourceNetwork);
    expect(purchase.targetNetwork).toBe(helper.targetNetwork);
    expect(purchase.tokenStatus).toBe(TokenStatus.BASE);
    expect(purchase.sellerTier).toBe(0);
    expect(purchase.sellerTokenTradingFeePercentage).toBeNull();

    const sellerBillPaymentsSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller!.uid)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .get();
    const sellerBillPayments = sellerBillPaymentsSnap.docs.map((d) => d.data() as Transaction);
    expect(
      sellerBillPayments.find(
        (bp) =>
          bp.payload.amount === MIN_IOTA_AMOUNT &&
          isEmpty(bp.payload.nativeTokens) &&
          isEmpty(bp.payload.storageReturn),
      ),
    ).toBeDefined();
    expect(
      sellerBillPayments.find(
        (bp) =>
          bp.payload.amount === MIN_IOTA_AMOUNT &&
          bp.payload.targetAddress === getAddress(helper.buyer, helper.sourceNetwork!),
      ),
    ).toBeDefined();
    const sellerCreditnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller!.uid)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(sellerCreditnap.size).toBe(0);

    const buyerBillPaymentsSnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer!.uid)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .get();
    const buyerBillPayments = buyerBillPaymentsSnap.docs.map((d) => d.data() as Transaction);
    expect(buyerBillPayments.length).toBe(3);
    expect(
      buyerBillPayments.find(
        (bp) =>
          bp.payload.amount === 1856400 &&
          isEmpty(bp.payload.nativeTokens) &&
          isEmpty(bp.payload.storageReturn),
      ),
    ).toBeDefined();
    expect(
      buyerBillPayments.find(
        (bp) =>
          bp.payload.amount === 91800 &&
          isEmpty(bp.payload.nativeTokens) &&
          bp.payload.storageReturn.amount === 46800,
      ),
    ).toBeDefined();
    expect(
      buyerBillPayments.find(
        (bp) =>
          bp.payload.amount === 51800 &&
          isEmpty(bp.payload.nativeTokens) &&
          bp.payload.storageReturn.amount === 46800,
      ),
    ).toBeDefined();
    expect(
      buyerBillPayments.find(
        (bp) =>
          bp.payload.amount === 1856400 &&
          bp.payload.targetAddress === getAddress(helper.seller, helper.targetNetwork),
      ),
    ).toBeDefined();
    const buyerCreditnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer!.uid)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(buyerCreditnap.size).toBe(0);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);

    const sellerAddress = getAddress(helper.seller, helper.targetNetwork);
    const targetWallet = await getWallet(helper.targetNetwork);
    expect(await targetWallet.getBalance(sellerAddress)).toBe(1856400);

    const buyerAddress = getAddress(helper.buyer, helper.sourceNetwork);
    const sourceWallet = await getWallet(helper.sourceNetwork);
    expect(await sourceWallet.getBalance(buyerAddress)).toBe(MIN_IOTA_AMOUNT);
  });

  it('Should create buy order with expiration from expiration unlock', async () => {
    const date = dayjs().add(2, 'h').millisecond(0).toDate();
    const expiresAt = admin.firestore.Timestamp.fromDate(date) as Timestamp;

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
      expiresAt,
    );

    const buyQuery = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.buyer!.uid);
    await wait(async () => {
      const snap = await buyQuery.get();
      return snap.size !== 0;
    });
    const buy = <TokenTradeOrder>(await buyQuery.get()).docs[0].data();

    expect(dayjs(buy.expiresAt.toDate()).isSame(dayjs(expiresAt.toDate()))).toBe(true);
  });

  it('Should credit buy order with expiration unlock, wrong amount', async () => {
    const date = dayjs().add(2, 'h').millisecond(0).toDate();
    const expiresAt = admin.firestore.Timestamp.fromDate(date) as Timestamp;

    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      symbol: helper.token!.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 2,
      type: TokenTradeOrderType.BUY,
    });
    const buyOrder = await testEnv.wrap(tradeToken)({});
    const { faucetAddress } = await requestFundsFromFaucet(
      helper.targetNetwork,
      buyOrder.payload.targetAddress,
      4 * MIN_IOTA_AMOUNT,
      expiresAt,
    );

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', helper.buyer?.uid)
        .get();
      return (
        snap.size === 1 &&
        snap.docs[0].data()!.payload.amount === 4 * MIN_IOTA_AMOUNT &&
        snap.docs[0].data()!.payload.targetAddress === faucetAddress.bech32
      );
    });
  });
});
