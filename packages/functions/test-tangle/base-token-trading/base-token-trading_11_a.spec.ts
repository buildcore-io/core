import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  SYSTEM_CONFIG_DOC_ID,
  TokenPurchase,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
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

  it('Should not create royalty payments, zero percentage fee', async () => {
    await build5Db()
      .doc(`${COL.SYSTEM}/${SYSTEM_CONFIG_DOC_ID}`)
      .set({ tokenTradingFeePercentage: 0 });

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

    const tradesQuery = build5Db()
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

    const purchaseQuery = build5Db()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length === 1;
    });

    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];
    expect(purchase.price).toBe(2);

    const billPayments = (
      await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload.token', '==', helper.token!.uid)
        .get()
    ).map((d) => <Transaction>d);
    expect(billPayments.length).toBe(2);

    const billPaymentToSeller = billPayments.find(
      (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 2 && bp.payload.owner === helper.seller!.uid,
    );
    expect(billPaymentToSeller).toBeDefined();

    const billPaymentToBuyer = billPayments.find(
      (bp) => bp.payload.amount === MIN_IOTA_AMOUNT && bp.payload.owner === helper.buyer!.uid,
    );
    expect(billPaymentToBuyer).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
