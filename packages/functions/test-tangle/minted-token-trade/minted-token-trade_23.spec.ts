import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  MIN_PRICE_PER_TOKEN,
  Network,
  TangleRequestType,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
} from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
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

  it('Should create market sell with tangle request, settle it, no balance', async () => {
    await helper.createBuyOrder(2, MIN_IOTA_AMOUNT);
    await helper.createBuyOrder(2, 2 * MIN_IOTA_AMOUNT);

    await helper.walletService!.send(
      helper.sellerAddress!,
      tangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.SELL_TOKEN,
            symbol: helper.token!.symbol,
          },
        },
        nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: BigInt(3) }],
      },
    );

    const sellQuery = database()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller!)
      .where('type', '==', TokenTradeOrderType.SELL);
    await wait(async () => {
      const snap = await sellQuery.get();
      return snap.length === 1 && snap[0].status === TokenTradeOrderStatus.SETTLED;
    });
    const sellOrder = (await sellQuery.get())[0];

    expect(sellOrder.count).toBe(3);
    expect(sellOrder.fulfilled).toBe(3);
    expect(sellOrder.balance).toBe(0);
    expect(sellOrder.price).toBe(MIN_PRICE_PER_TOKEN);

    const buyOrders = await database()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.buyer!)
      .where('type', '==', TokenTradeOrderType.BUY)
      .get();
    buyOrders.sort((a, b) => b.price - a.price);

    expect(buyOrders[0].price).toBe(2 * MIN_IOTA_AMOUNT);
    expect(buyOrders[0].fulfilled).toBe(2);
    expect(buyOrders[1].price).toBe(MIN_IOTA_AMOUNT);
    expect(buyOrders[1].fulfilled).toBe(1);
  });
});
