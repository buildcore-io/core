import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  TokenPurchase,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should create royalty payments for different percentage', async () => {
    await database().doc(COL.MEMBER, helper.seller!.uid).update({ tokenTradingFeePercentage: 1 });
    mockWalletReturnValue(helper.seller!.uid, {
      symbol: helper.token!.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 2,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      sellOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
    );

    const tradesQuery = database()
      .collection(COL.TOKEN_MARKET)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await tradesQuery.get();
      return snap.length === 1;
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

    const purchaseQuery = database()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length === 1;
    });

    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];
    expect(purchase.price).toBe(2);

    const billPayments = (
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload_token', '==', helper.token!.uid)
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
