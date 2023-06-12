import {
  COL,
  MIN_IOTA_AMOUNT,
  TICKERS,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@build-5/interfaces';
import { getById } from '../../src/api/getById';
import { getTokenPrice } from '../../src/api/getTokenPrice';
import { soonDb } from '../../src/firebase/firestore/soondb';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Token price', () => {
  it('Should get token price', async () => {
    const token = getRandomEthAddress();
    const tickerDocRef = soonDb().doc(`${COL.TICKER}/${TICKERS.SMRUSD}`);
    await tickerDocRef.delete();
    await tickerDocRef.set({ price: 0.5 });
    await soonDb().doc(`${COL.TOKEN_MARKET}/${getRandomEthAddress()}`).create({
      token,
      status: TokenTradeOrderStatus.ACTIVE,
      type: TokenTradeOrderType.SELL,
      price: MIN_IOTA_AMOUNT,
    });

    await soonDb()
      .doc(`${COL.TOKEN_MARKET}/${getRandomEthAddress()}`)
      .create({
        token,
        status: TokenTradeOrderStatus.ACTIVE,
        type: TokenTradeOrderType.BUY,
        price: 4 * MIN_IOTA_AMOUNT,
      });

    const req = { query: { token } } as any;
    const res = {
      send: (body: any) => {
        expect(body.id).toBe(token);
        expect(body.price).toBe(2.5 * MIN_IOTA_AMOUNT);
        expect(body.usdPrice).toBe(1.25);
      },
    } as any;
    await getTokenPrice(req, res);
  });

  it('Should get ticker', async () => {
    await soonDb().doc(`${COL.TICKER}/${TICKERS.SMRUSD}`).set({ price: 0.5 });
    const req = { query: { collection: COL.TICKER, uid: TICKERS.SMRUSD } } as any;
    const res = {
      send: (body: any) => {
        expect(body.price).toBe(0.5);
      },
    } as any;
    await getById(req, res);
  });
});
