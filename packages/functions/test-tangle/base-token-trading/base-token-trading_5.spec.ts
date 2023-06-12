import { COL, MIN_IOTA_AMOUNT, TokenPurchase, TokenTradeOrderType } from '@build5/interfaces';
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

  it('Should fulfill buy with lowest sell', async () => {
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
      sellOrder.payload.amount,
    );

    mockWalletReturnValue(helper.walletSpy, helper.seller!.uid, {
      symbol: helper.token!.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 1,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder2 = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      sellOrder2.payload.targetAddress,
      sellOrder2.payload.amount,
    );

    await wait(async () => {
      const snap = await soonDb()
        .collection(COL.TOKEN_MARKET)
        .where('owner', '==', helper.seller!.uid)
        .get();
      return snap.length === 2;
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
      buyOrder.payload.amount,
    );

    const purchaseQuery = soonDb()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length === 1;
    });
    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];

    expect(purchase.count).toBe(MIN_IOTA_AMOUNT);
    expect(purchase.price).toBe(1);
    expect(purchase.sourceNetwork).toBe(helper.sourceNetwork);
    expect(purchase.targetNetwork).toBe(helper.targetNetwork);
    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
