import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import {
  Network,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
} from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import admin from '../../src/admin.config';
import { tradeToken } from '../../src/controls/token-trading/token-trade.controller';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsForManyFromFaucet, requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeAll();
  });

  it('Should fulfill many buys with sell', async () => {
    const count = 15;

    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      token: helper.token,
      count: MIN_IOTA_AMOUNT,
      price: 1,
      type: TokenTradeOrderType.BUY,
    });
    const promises = Array.from(Array(count)).map(() => testEnv.wrap(tradeToken)({}));
    const orders: Transaction[] = await Promise.all(promises);
    await requestFundsForManyFromFaucet(
      Network.RMS,
      orders.map((o) => ({ toAddress: o.payload.targetAddress, amount: o.payload.amount })),
    );

    const tradeQuery = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('token', '==', helper.token);
    await wait(async () => {
      const snap = await tradeQuery.get();
      return snap.size === count;
    });

    mockWalletReturnValue(helper.walletSpy, helper.seller!.uid, {
      token: helper.token,
      count: count * MIN_IOTA_AMOUNT,
      price: 1,
      type: TokenTradeOrderType.SELL,
    });
    const trade = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(Network.ATOI, trade.payload.targetAddress, trade.payload.amount);

    await wait(async () => {
      const snap = await tradeQuery.get();
      return snap.size === count + 1;
    });

    await wait(async () => {
      const trades = (await tradeQuery.get()).docs.map((d) => <TokenTradeOrder>d.data());
      const allFulfilled = trades.reduce(
        (acc, act) => acc && act.status === TokenTradeOrderStatus.SETTLED,
        true,
      );
      return allFulfilled;
    });

    await awaitTransactionConfirmationsForToken(helper.token!);
  });

  afterEach(async () => {
    await helper.listenerATOI!.cancel();
    await helper.listenerRMS!.cancel();
  });
});
