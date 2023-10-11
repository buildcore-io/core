import {
  COL,
  MIN_IOTA_AMOUNT,
  Network,
  TangleRequestType,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
} from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { wait } from '../../test/controls/common';
import { getTangleOrder } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Base token trading', () => {
  const helper = new Helper();
  let atoiTangleOrder: Transaction;
  let rmsTangleOrder: Transaction;

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should create sell order with tangle', async () => {
    atoiTangleOrder = await getTangleOrder(Network.ATOI);
    const atoiAddress = helper.sellerValidateAddress[Network.ATOI];
    await requestFundsFromFaucet(helper.sourceNetwork, atoiAddress.bech32, MIN_IOTA_AMOUNT);

    await helper.atoiWallet!.send(
      atoiAddress,
      atoiTangleOrder.payload.targetAddress!,
      MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.SELL_TOKEN,
            symbol: helper.token?.symbol!,
            count: MIN_IOTA_AMOUNT,
            price: 1.5,
          },
        },
      },
    );

    const query = build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', helper.seller!.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length > 0;
    });
    const orderSnap = await query.get<TokenTradeOrder>();
    const sellOrder = orderSnap[0];
    expect(sellOrder.owner).toBe(helper.seller!.uid);
    expect(sellOrder.price).toBe(1.5);
    expect(sellOrder.count).toBe(MIN_IOTA_AMOUNT);
    expect(sellOrder.type).toBe(TokenTradeOrderType.SELL);
  });

  it('Should buy base token with tangle request', async () => {
    rmsTangleOrder = await getTangleOrder(Network.RMS);
    const rmsAddress = helper.buyerValidateAddress[Network.RMS];
    await requestFundsFromFaucet(helper.targetNetwork, rmsAddress.bech32, 5 * MIN_IOTA_AMOUNT);

    await helper.rmsWallet!.send(
      rmsAddress,
      rmsTangleOrder.payload.targetAddress!,
      1.5 * MIN_IOTA_AMOUNT,
      {
        customMetadata: {
          request: {
            requestType: TangleRequestType.BUY_TOKEN,
            symbol: helper.token?.symbol!,
            count: MIN_IOTA_AMOUNT,
            price: 1.5,
          },
        },
      },
    );

    const query = build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer!.uid);
    await wait(async () => {
      const snap = await query.get();
      return snap.length > 0;
    });
    const snap = await query.get();
    const sellOrder = <TokenTradeOrder>snap[0];
    expect(sellOrder.owner).toBe(helper.buyer!.uid);
    expect(sellOrder.price).toBe(1.5);
    expect(sellOrder.count).toBe(MIN_IOTA_AMOUNT);
    expect(sellOrder.type).toBe(TokenTradeOrderType.BUY);
  });
});
