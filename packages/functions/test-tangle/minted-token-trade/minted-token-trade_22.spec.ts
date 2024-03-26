import { build5Db } from '@build-5/database';
import {
  COL,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
} from '@build-5/interfaces';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted toke trading tangle request', () => {
  const helper = new Helper();
  let tangleOrder: Transaction;

  beforeAll(async () => {
    await helper.berforeAll();
    tangleOrder = await getTangleOrder(Network.RMS);
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should create market buy with tangle request, do not fullfill it', async () => {
    await helper.createSellTradeOrder(1, MIN_IOTA_AMOUNT);
    await helper.createSellTradeOrder(2, 2 * MIN_IOTA_AMOUNT);

    const tmp = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, tmp.bech32, 6 * MIN_IOTA_AMOUNT);

    await helper.walletService!.send(tmp, tangleOrder.payload.targetAddress!, 6 * MIN_IOTA_AMOUNT, {
      customMetadata: {
        request: {
          requestType: TangleRequestType.BUY_TOKEN,
          symbol: helper.token!.symbol,
        },
      },
    });

    const buyQuery = build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', tmp.bech32)
      .where('type', '==', TokenTradeOrderType.BUY);
    await wait(async () => {
      const snap = await buyQuery.get();
      return snap.length === 1 && snap[0].fulfilled === 3;
    });
    const buyOrder = (await buyQuery.get())[0];

    expect(buyOrder.count).toBe(MAX_TOTAL_TOKEN_SUPPLY);
    expect(buyOrder.fulfilled).toBe(3);
    expect(buyOrder.balance).toBe(MIN_IOTA_AMOUNT);
    expect(buyOrder.status).toBe(TokenTradeOrderStatus.ACTIVE);

    const sellOrders = await build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller)
      .where('type', '==', TokenTradeOrderType.SELL)
      .get();
    sellOrders.sort((a, b) => a.price - b.price);

    expect(sellOrders[0].price).toBe(MIN_IOTA_AMOUNT);
    expect(sellOrders[0].fulfilled).toBe(1);
    expect(sellOrders[1].price).toBe(2 * MIN_IOTA_AMOUNT);
    expect(sellOrders[1].fulfilled).toBe(2);
  });
});
