import { COL, MIN_IOTA_AMOUNT, TokenPurchase, TokenTradeOrderType } from '@soon/interfaces';
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

  it('Should fulfill sell with highest buy', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      token: helper.token,
      count: MIN_IOTA_AMOUNT,
      price: 1,
      type: TokenTradeOrderType.BUY,
    });
    const buyOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.targetNetwork,
      buyOrder.payload.targetAddress,
      buyOrder.payload.amount,
    );

    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      token: helper.token,
      count: MIN_IOTA_AMOUNT,
      price: 2,
      type: TokenTradeOrderType.BUY,
    });
    const buyOrder2 = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.targetNetwork,
      buyOrder2.payload.targetAddress,
      buyOrder2.payload.amount,
    );

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('owner', '==', helper.buyer!.uid)
        .get();
      return snap.size === 2;
    });

    mockWalletReturnValue(helper.walletSpy, helper.seller!.uid, {
      token: helper.token,
      count: MIN_IOTA_AMOUNT,
      price: 1,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      sellOrder.payload.targetAddress,
      sellOrder.payload.amount,
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

    expect(purchase.count).toBe(MIN_IOTA_AMOUNT);
    expect(purchase.price).toBe(2);
    expect(purchase.sourceNetwork).toBe(helper.sourceNetwork);
    expect(purchase.targetNetwork).toBe(helper.targetNetwork);

    await awaitTransactionConfirmationsForToken(helper.token!);
  });

  afterEach(async () => {
    await helper.listenerATOI!.cancel();
    await helper.listenerRMS!.cancel();
  });
});
