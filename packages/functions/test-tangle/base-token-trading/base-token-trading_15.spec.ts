import { database } from '@buildcore/database';
import {
  COL,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  TokenTradeOrderType,
  Transaction,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();
  let rmsTangleOrder: Transaction;

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should create market buy with tangle request,do not settle it', async () => {
    mockWalletReturnValue(helper.seller!.uid, {
      symbol: helper.token!.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 2,
      type: TokenTradeOrderType.SELL,
    });
    let sellOrder = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      sellOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
    );

    mockWalletReturnValue(helper.seller!.uid, {
      symbol: helper.token!.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 4,
      type: TokenTradeOrderType.SELL,
    });
    sellOrder = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      sellOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
    );

    rmsTangleOrder = await getTangleOrder(Network.RMS);
    const rmsAddress = helper.buyerValidateAddress[Network.RMS];
    await requestFundsFromFaucet(helper.targetNetwork, rmsAddress.bech32, 7 * MIN_IOTA_AMOUNT);

    await helper.rmsWallet!.send(
      rmsAddress,
      rmsTangleOrder.payload.targetAddress!,
      7 * MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.BUY_TOKEN,
            symbol: helper.token?.symbol!,
          },
        },
      },
    );

    const query = database().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer!.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1 && snap[0].fulfilled === 2 * MIN_IOTA_AMOUNT;
    });
    const buyOrder = (await query.get())[0];

    expect(buyOrder.count).toBe(MAX_TOTAL_TOKEN_SUPPLY);
    expect(buyOrder.fulfilled).toBe(2 * MIN_IOTA_AMOUNT);
    expect(buyOrder.balance).toBe(MIN_IOTA_AMOUNT);

    const sellOrders = await database()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller?.uid)
      .where('type', '==', TokenTradeOrderType.SELL)
      .get();
    sellOrders.sort((a, b) => a.price - b.price);

    expect(sellOrders[0].price).toBe(2);
    expect(sellOrders[0].fulfilled).toBe(MIN_IOTA_AMOUNT);
    expect(sellOrders[1].price).toBe(4);
    expect(sellOrders[1].fulfilled).toBe(MIN_IOTA_AMOUNT);
  });
});
