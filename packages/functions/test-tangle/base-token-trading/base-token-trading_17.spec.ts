import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  TokenTradeOrder,
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
  let atoiTangleOrder: Transaction;

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should create market sell with tangle request, do not settle it', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      symbol: helper.token!.symbol,
      count: 2 * MIN_IOTA_AMOUNT,
      price: 1,
      type: TokenTradeOrderType.BUY,
    });
    let buyOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      buyOrder.payload.targetAddress,
      buyOrder.payload.amount,
    );

    mockWalletReturnValue(helper.walletSpy, helper.buyer!.uid, {
      symbol: helper.token!.symbol,
      count: 4 * MIN_IOTA_AMOUNT,
      price: 2,
      type: TokenTradeOrderType.BUY,
    });
    buyOrder = await testEnv.wrap(tradeToken)({});
    await requestFundsFromFaucet(
      helper.sourceNetwork,
      buyOrder.payload.targetAddress,
      buyOrder.payload.amount,
    );

    atoiTangleOrder = await getTangleOrder(Network.ATOI);
    const atoiAddress = helper.sellerValidateAddress[Network.ATOI];
    await requestFundsFromFaucet(helper.sourceNetwork, atoiAddress.bech32, 7 * MIN_IOTA_AMOUNT);

    await helper.atoiWallet!.send(
      atoiAddress,
      atoiTangleOrder.payload.targetAddress!,
      7 * MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.SELL_TOKEN,
            symbol: helper.token?.symbol!,
          },
        },
      },
    );

    const query = build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', helper.seller!.uid);
    await wait(async () => {
      const snap = await query.get<TokenTradeOrder>();
      return snap.length === 1 && snap[0].fulfilled === 6 * MIN_IOTA_AMOUNT;
    });
    const sellOrder = (await query.get<TokenTradeOrder>())[0];

    expect(sellOrder.count).toBe(7 * MIN_IOTA_AMOUNT);
    expect(sellOrder.fulfilled).toBe(6 * MIN_IOTA_AMOUNT);
    expect(sellOrder.balance).toBe(MIN_IOTA_AMOUNT);

    const buyOrders = await build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.buyer?.uid)
      .get<TokenTradeOrder>();
    buyOrders.sort((a, b) => b.price - a.price);

    expect(buyOrders[0].price).toBe(2);
    expect(buyOrders[0].fulfilled).toBe(4 * MIN_IOTA_AMOUNT);
    expect(buyOrders[1].price).toBe(1);
    expect(buyOrders[1].fulfilled).toBe(2 * MIN_IOTA_AMOUNT);
  });
});
