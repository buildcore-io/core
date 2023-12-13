import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Timestamp,
  TokenPurchase,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionPayloadType,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import { tradeToken } from '../../src/runtime/firebase/token/trading';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
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

    const sellQuery = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller!.uid);
    await wait(async () => {
      const snap = await sellQuery.get();
      return snap.length !== 0;
    });

    const sell = <TokenTradeOrder>(await sellQuery.get())[0];
    expect(sell.tokenStatus).toBe(TokenStatus.BASE);

    const buyQuery = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.buyer!.uid);
    await wait(async () => {
      const snap = await buyQuery.get();
      return snap.length !== 0;
    });
    const buy = <TokenTradeOrder>(await buyQuery.get())[0];
    expect(buy.tokenStatus).toBe(TokenStatus.BASE);

    const purchaseQuery = build5Db()
      .collection(COL.TOKEN_PURCHASE)
      .where('sell', '==', sell.uid)
      .where('buy', '==', buy.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length !== 0;
    });
    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];

    expect(purchase.count).toBe(MIN_IOTA_AMOUNT);
    expect(purchase.price).toBe(2);
    expect(purchase.sourceNetwork).toBe(helper.sourceNetwork);
    expect(purchase.targetNetwork).toBe(helper.targetNetwork);
    expect(purchase.tokenStatus).toBe(TokenStatus.BASE);
    expect(purchase.sellerTier).toBe(0);
    expect(purchase.sellerTokenTradingFeePercentage).toBeNull();

    const sellerBillPaymentsSnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller!.uid)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .get();
    const sellerBillPayments = sellerBillPaymentsSnap.map((d) => d as Transaction);
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
    sellerBillPayments.forEach((sellerBillPayment) => {
      expect(sellerBillPayment.payload.token).toBe(helper.token!.uid);
      expect(sellerBillPayment.payload.tokenSymbol).toBe(helper.token!.symbol);
      expect(sellerBillPayment.payload.type).toBe(TransactionPayloadType.BASE_TOKEN_TRADE);
    });
    const sellerCreditSnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller!.uid)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(sellerCreditSnap.length).toBe(0);

    const buyerBillPaymentsSnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer!.uid)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .get();
    const buyerBillPayments = buyerBillPaymentsSnap.map((d) => d as Transaction);
    expect(buyerBillPayments.length).toBe(3);
    expect(
      buyerBillPayments.find(
        (bp) =>
          bp.payload.amount === 1856400 &&
          isEmpty(bp.payload.nativeTokens) &&
          isEmpty(bp.payload.storageReturn),
      ),
    ).toBeDefined();
    buyerBillPayments.forEach((buyerBillPayment) => {
      expect(buyerBillPayment.payload.token).toBe(helper.token!.uid);
      expect(buyerBillPayment.payload.tokenSymbol).toBe(helper.token!.symbol);
      expect(buyerBillPayment.payload.type).toBe(TransactionPayloadType.BASE_TOKEN_TRADE);
    });
    expect(
      buyerBillPayments.find(
        (bp) =>
          bp.payload.amount === 91800 &&
          isEmpty(bp.payload.nativeTokens) &&
          bp.payload.storageReturn!.amount === 46800,
      ),
    ).toBeDefined();
    expect(
      buyerBillPayments.find(
        (bp) =>
          bp.payload.amount === 51800 &&
          isEmpty(bp.payload.nativeTokens) &&
          bp.payload.storageReturn!.amount === 46800,
      ),
    ).toBeDefined();
    expect(
      buyerBillPayments.find(
        (bp) =>
          bp.payload.amount === 1856400 &&
          bp.payload.targetAddress === getAddress(helper.seller, helper.targetNetwork),
      ),
    ).toBeDefined();
    const buyerCreditnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer!.uid)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(buyerCreditnap.length).toBe(0);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);

    const sellerAddress = getAddress(helper.seller, helper.targetNetwork);
    const targetWallet = await getWallet(helper.targetNetwork);
    expect((await targetWallet.getBalance(sellerAddress)).amount).toBe(1856400);

    const buyerAddress = getAddress(helper.buyer, helper.sourceNetwork);
    const sourceWallet = await getWallet(helper.sourceNetwork);
    expect((await sourceWallet.getBalance(buyerAddress)).amount).toBe(MIN_IOTA_AMOUNT);
  });

  it('Should create buy order with expiration from expiration unlock', async () => {
    const date = dayjs().add(2, 'h').millisecond(0).toDate();
    const expiresAt = dateToTimestamp(date);

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

    const buyQuery = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.buyer!.uid);
    await wait(async () => {
      const snap = await buyQuery.get();
      return snap.length !== 0;
    });
    const buy = <TokenTradeOrder>(await buyQuery.get())[0];

    expect(dayjs(buy.expiresAt.toDate()).isSame(dayjs(expiresAt.toDate()))).toBe(true);
  });

  it('Should not credit buy order with expiration unlock, custom amount', async () => {
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

    const date = dayjs().add(2, 'h').millisecond(0).toDate();
    const expiresAt = dateToTimestamp(date) as Timestamp;

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
      4 * MIN_IOTA_AMOUNT,
      expiresAt,
    );

    const buyQuery = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('type', '==', TokenTradeOrderType.BUY)
      .where('owner', '==', helper.buyer?.uid);
    await wait(async () => {
      const snap = await buyQuery.get<TokenTradeOrder>();
      return snap.length === 1 && snap[0].status === TokenTradeOrderStatus.SETTLED;
    });
    const buy = (await buyQuery.get<TokenTradeOrder>())[0];
    expect(buy.balance).toBe(2 * MIN_IOTA_AMOUNT);
    expect(buy.count).toBe(MIN_IOTA_AMOUNT);
    expect(buy.fulfilled).toBe(MIN_IOTA_AMOUNT);

    const credit = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer?.uid)
      .where('payload.type', '==', TransactionPayloadType.TOKEN_TRADE_FULLFILLMENT)
      .get<Transaction>();
    expect(credit.length).toBe(1);
    expect(credit[0].payload.amount).toBe(2 * MIN_IOTA_AMOUNT);
  });
});
