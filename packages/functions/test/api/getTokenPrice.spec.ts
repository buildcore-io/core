import { COL, TokenTradeOrderStatus, TokenTradeOrderType } from '@soon/interfaces';
import admin from '../../src/admin.config';
import { getTokenPrice } from '../../src/api/getTokenPrice';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';

describe('Token price', () => {
  it('Should get token price', async () => {
    const token = getRandomEthAddress();
    await admin.firestore().doc(`${COL.TOKEN_MARKET}/${getRandomEthAddress()}`).create({
      token,
      status: TokenTradeOrderStatus.ACTIVE,
      type: TokenTradeOrderType.SELL,
      price: 1,
    });

    await admin.firestore().doc(`${COL.TOKEN_MARKET}/${getRandomEthAddress()}`).create({
      token,
      status: TokenTradeOrderStatus.ACTIVE,
      type: TokenTradeOrderType.BUY,
      price: 4,
    });

    const req = { query: { token } } as any;
    const res = {
      send: (body: any) => {
        expect(body.id).toBe(token);
        expect(body.price).toBe(2.5);
      },
    } as any;
    await getTokenPrice(req, res);
  });
});
