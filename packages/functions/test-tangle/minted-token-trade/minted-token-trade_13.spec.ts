/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  WEN_FUNC,
} from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsForManyFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.berforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Fulfill many buys with sell', async () => {
    const count = 15;
    mockWalletReturnValue(helper.buyer!, {
      symbol: helper.token!.symbol,
      count: 1,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.BUY,
    });
    const promises = Array.from(Array(count)).map(() =>
      testEnv.wrap<Transaction>(WEN_FUNC.tradeToken),
    );
    const orders = await Promise.all(promises);
    await requestFundsForManyFromFaucet(
      Network.RMS,
      orders.map((o) => ({ toAddress: o.payload.targetAddress!, amount: o.payload.amount! })),
    );

    const tradeQuery = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await tradeQuery.get();
      return snap.length === count;
    });

    await helper.createSellTradeOrder(15, MIN_IOTA_AMOUNT);

    await wait(async () => {
      const snap = await tradeQuery.get();
      return snap.length === count + 1;
    });

    await wait(async () => {
      const trades = (await tradeQuery.get()).map((d) => <TokenTradeOrder>d);
      const allFulfilled = trades.reduce(
        (acc, act) => acc && act.status === TokenTradeOrderStatus.SETTLED,
        true,
      );
      return allFulfilled;
    });
  });
});
