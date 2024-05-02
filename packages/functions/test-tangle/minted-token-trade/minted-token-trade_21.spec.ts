import { database } from '@buildcore/database';
import {
  COL,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
} from '@buildcore/interfaces';
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

  it('Should create market buy with tangle request, settle it, no balance', async () => {
    await helper.createSellTradeOrder();
    await helper.createSellTradeOrder(10, 2 * MIN_IOTA_AMOUNT);

    const tmp = await helper.walletService!.getNewIotaAddressDetails();
    await requestFundsFromFaucet(Network.RMS, tmp.bech32, 20 * MIN_IOTA_AMOUNT);

    await helper.walletService!.send(
      tmp,
      tangleOrder.payload.targetAddress!,
      20 * MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.BUY_TOKEN,
            symbol: helper.token!.symbol,
          },
        },
      },
    );

    const buyQuery = database()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', tmp.bech32)
      .where('type', '==', TokenTradeOrderType.BUY);
    await wait(async () => {
      const snap = await buyQuery.get();
      return snap.length === 1 && snap[0].status === TokenTradeOrderStatus.SETTLED;
    });
    const buyOrder = (await buyQuery.get())[0];

    expect(buyOrder.count).toBe(MAX_TOTAL_TOKEN_SUPPLY);
    expect(buyOrder.fulfilled).toBe(15);
    expect(buyOrder.balance).toBe(0);

    const sellOrders = await database()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller)
      .where('type', '==', TokenTradeOrderType.SELL)
      .get();
    sellOrders.sort((a, b) => a.price - b.price);

    expect(sellOrders[0].price).toBe(MIN_IOTA_AMOUNT);
    expect(sellOrders[0].fulfilled).toBe(10);
    expect(sellOrders[1].price).toBe(2 * MIN_IOTA_AMOUNT);
    expect(sellOrders[1].fulfilled).toBe(5);
  });
});
