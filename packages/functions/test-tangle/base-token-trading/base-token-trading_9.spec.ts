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
import { requestFundsForManyFromFaucet, requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should fulfill many buys with sell', async () => {
    const count = 15;

    mockWalletReturnValue(helper.buyer!.uid, {
      symbol: helper.token!.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 1,
      type: TokenTradeOrderType.BUY,
    });
    const promises = Array.from(Array(count)).map(() =>
      testEnv.wrap<Transaction>(WEN_FUNC.tradeToken),
    );
    const orders: Transaction[] = await Promise.all(promises);
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

    mockWalletReturnValue(helper.seller!.uid, {
      symbol: helper.token!.symbol,
      count: count * MIN_IOTA_AMOUNT,
      price: 1,
      type: TokenTradeOrderType.SELL,
    });
    const trade = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await requestFundsFromFaucet(Network.ATOI, trade.payload.targetAddress, trade.payload.amount);

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
