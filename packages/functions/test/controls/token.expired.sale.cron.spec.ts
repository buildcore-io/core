import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  SOON_PROJECT_ID,
  SUB_COL,
  Token,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { cancelExpiredSale } from '../../src/cron/token.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { testEnv } from '../set-up';
import { getRandomSymbol, wait } from './common';

describe('Expired sales cron', () => {
  let seller: string;
  let token: Token;
  beforeEach(async () => {
    seller = await testEnv.createMember();
    const tokenId = wallet.getRandomEthAddress();
    const tokenUpsert = {
      project: SOON_PROJECT_ID,
      uid: tokenId,
      symbol: getRandomSymbol(),
      name: 'MyToken',
      space: 'myspace',
      status: TokenStatus.PRE_MINTED,
      approved: true,
    };
    await database().doc(COL.TOKEN, tokenId).upsert(tokenUpsert);
    token = (await database().doc(COL.TOKEN, tokenId).get())!;
    const distribution = { tokenOwned: 1000 };
    await database().doc(COL.TOKEN, tokenId, SUB_COL.DISTRIBUTION, seller).upsert(distribution);
  });

  it('Should cancel all expired sales', async () => {
    const salesCount = 160;
    const getDummySell = (
      status: TokenTradeOrderStatus,
      type: TokenTradeOrderType,
    ): TokenTradeOrder => ({
      project: SOON_PROJECT_ID,
      uid: wallet.getRandomEthAddress(),
      owner: seller,
      token: token.uid,
      type,
      count: 1,
      price: MIN_IOTA_AMOUNT,
      totalDeposit: MIN_IOTA_AMOUNT,
      balance: 0,
      fulfilled: 0,
      status,
      expiresAt: dateToTimestamp(dayjs().subtract(1, 'minute')),
    });
    const createSales = async (
      status: TokenTradeOrderStatus,
      type: TokenTradeOrderType,
      count: number,
    ) => {
      const sells = Array.from(Array(count)).map(() => getDummySell(status, type));
      const batch = database().batch();
      const promises = sells.map((s) => batch.create(database().doc(COL.TOKEN_MARKET, s.uid), s));
      await Promise.all(promises);
      await batch.commit();
      return sells;
    };
    await createSales(TokenTradeOrderStatus.ACTIVE, TokenTradeOrderType.SELL, salesCount);
    await createSales(TokenTradeOrderStatus.SETTLED, TokenTradeOrderType.SELL, 3);
    await wait(async () => {
      const snap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('owner', '==', seller)
        .where('status', '==', TokenTradeOrderStatus.ACTIVE)
        .get();
      const processed = snap.reduce(
        (sum, act) => sum && (<TokenTradeOrder>act).updatedOn !== undefined,
        true,
      );
      return processed;
    });
    await cancelExpiredSale();
    const snap = await database()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', seller)
      .where('status', '==', TokenTradeOrderStatus.EXPIRED)
      .get();
    expect(snap.length).toBe(salesCount);
  });
});
