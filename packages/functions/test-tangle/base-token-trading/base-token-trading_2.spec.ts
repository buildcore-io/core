import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  TokenPurchase,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { isEmpty } from 'lodash';
import { getAddress } from '../../src/utils/address.utils';
import { wait } from '../../test/controls/common';
import { getWallet, mockWalletReturnValue, testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should fulfil trade with half price', async () => {
    mockWalletReturnValue(helper.seller!.uid, {
      symbol: helper.token!.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 1,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      sellOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
    );

    const sellQuery = database()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller!.uid);
    await wait(async () => {
      const snap = await sellQuery.get();
      return snap.length !== 0;
    });

    mockWalletReturnValue(helper.buyer!.uid, {
      symbol: helper.token!.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 2,
      type: TokenTradeOrderType.BUY,
    });
    const buyOrder = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await requestFundsFromFaucet(
      helper.targetNetwork,
      buyOrder.payload.targetAddress,
      2 * MIN_IOTA_AMOUNT,
    );

    const sell = <TokenTradeOrder>(await sellQuery.get())[0];

    const buyQuery = database()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.buyer!.uid);
    await wait(async () => {
      const snap = await buyQuery.get();
      return snap.length !== 0;
    });
    let buy = <TokenTradeOrder>(await buyQuery.get())[0];

    const purchaseQuery = database()
      .collection(COL.TOKEN_PURCHASE)
      .where('sell', '==', sell.uid)
      .where('buy', '==', buy.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length !== 0;
    });
    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];

    expect(purchase.count).toBe(MIN_IOTA_AMOUNT);
    expect(purchase.price).toBe(1);
    expect(purchase.sourceNetwork).toBe(helper.sourceNetwork);
    expect(purchase.targetNetwork).toBe(helper.targetNetwork);

    const sellerBillPaymentsSnap = await database()
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
          bp.payload.targetAddress === getAddress(helper.buyer, helper.sourceNetwork),
      ),
    ).toBeDefined();
    const sellerCreditnap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller!.uid)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    const sellerCredit = sellerCreditnap.map((d) => d as Transaction);
    expect(sellerCredit.length).toBe(0);

    const buyerBillPaymentsSnap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer!.uid)
      .where('type', '==', TransactionType.BILL_PAYMENT)
      .get();
    const buyerBillPayments = buyerBillPaymentsSnap.map((d) => d as Transaction);
    expect(buyerBillPayments.length).toBe(3);
    expect(
      buyerBillPayments.find(
        (bp) =>
          bp.payload.amount === 881400 &&
          isEmpty(bp.payload.nativeTokens) &&
          isEmpty(bp.payload.storageReturn),
      ),
    ).toBeDefined();
    expect(
      buyerBillPayments.find(
        (bp) =>
          bp.payload.amount === 69300 &&
          isEmpty(bp.payload.nativeTokens) &&
          bp.payload.storageReturn!.amount === 46800,
      ),
    ).toBeDefined();
    expect(
      buyerBillPayments.find(
        (bp) =>
          bp.payload.amount === 49300 &&
          isEmpty(bp.payload.nativeTokens) &&
          bp.payload.storageReturn!.amount === 46800,
      ),
    ).toBeDefined();
    expect(
      buyerBillPayments.find(
        (bp) =>
          bp.payload.amount === 881400 &&
          bp.payload.targetAddress === getAddress(helper.seller, helper.targetNetwork),
      ),
    ).toBeDefined();
    const buyerCreditnap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer!.uid)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(buyerCreditnap.length).toBe(1);
    expect(buyerCreditnap[0]?.payload.amount).toBe(MIN_IOTA_AMOUNT);
    buy = <TokenTradeOrder>(await buyQuery.get())[0];
    expect(buy.creditTransactionId).toBe(buyerCreditnap[0].uid);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);

    const sellerAddress = getAddress(helper.seller, helper.targetNetwork);
    const targetWallet = await getWallet(helper.targetNetwork);
    expect((await targetWallet.getBalance(sellerAddress)).amount).toBe(881400);

    const buyerAddress = getAddress(helper.buyer, helper.sourceNetwork);
    const buyerCreditAddress = getAddress(helper.buyer, helper.targetNetwork);
    const sourceWallet = await getWallet(helper.sourceNetwork);
    expect((await sourceWallet.getBalance(buyerAddress)).amount).toBe(MIN_IOTA_AMOUNT);
    expect((await targetWallet.getBalance(buyerCreditAddress)).amount).toBe(MIN_IOTA_AMOUNT);
  });
});
