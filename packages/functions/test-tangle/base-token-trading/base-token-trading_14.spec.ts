import { build5Db } from '@build-5/database';
import {
  COL,
  MAX_TOTAL_TOKEN_SUPPLY,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
} from '@build-5/interfaces';
import { tradeToken } from '../../src/runtime/firebase/token/trading';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();
  let rmsTangleOrder: Transaction;

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should create market buy with tangle request, settle it, no balance', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.seller!.uid, {
      symbol: helper.token!.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 2,
      type: TokenTradeOrderType.SELL,
    });
    let sellOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      sellOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
    );

    mockWalletReturnValue(helper.walletSpy, helper.seller!.uid, {
      symbol: helper.token!.symbol,
      count: MIN_IOTA_AMOUNT,
      price: 4,
      type: TokenTradeOrderType.SELL,
    });
    sellOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      sellOrder.payload.targetAddress,
      MIN_IOTA_AMOUNT,
    );

    rmsTangleOrder = await getTangleOrder(Network.RMS);
    const rmsAddress = helper.buyerValidateAddress[Network.RMS];
    await requestFundsFromFaucet(helper.targetNetwork, rmsAddress.bech32, 4 * MIN_IOTA_AMOUNT);

    await helper.rmsWallet!.send(
      rmsAddress,
      rmsTangleOrder.payload.targetAddress!,
      4 * MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.BUY_TOKEN,
            symbol: helper.token?.symbol!,
          },
        },
      },
    );

    const query = build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer!.uid);
    await wait(async () => {
      const snap = await query.get<TokenTradeOrder>();
      return snap.length === 1 && snap[0].status === TokenTradeOrderStatus.SETTLED;
    });
    const buyOrder = (await query.get<TokenTradeOrder>())[0];

    expect(buyOrder.count).toBe(MAX_TOTAL_TOKEN_SUPPLY);
    expect(buyOrder.fulfilled).toBe(1.5 * MIN_IOTA_AMOUNT);
    expect(buyOrder.balance).toBe(0);

    const sellOrders = await build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller?.uid)
      .where('type', '==', TokenTradeOrderType.SELL)
      .get<TokenTradeOrder>();
    sellOrders.sort((a, b) => a.price - b.price);

    expect(sellOrders[0].price).toBe(2);
    expect(sellOrders[0].fulfilled).toBe(MIN_IOTA_AMOUNT);
    expect(sellOrders[1].price).toBe(4);
    expect(sellOrders[1].fulfilled).toBe(0.5 * MIN_IOTA_AMOUNT);
  });
});
