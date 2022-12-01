import {
  COL,
  MIN_IOTA_AMOUNT,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { cancelExpiredSale } from '../../src/cron/token.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { createMember, getRandomSymbol, wait } from './common';

let walletSpy: any;

describe('Expired sales cron', () => {
  let seller: string;

  let token: Token;

  beforeEach(async () => {
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    seller = await createMember(walletSpy);

    const tokenId = wallet.getRandomEthAddress();
    token = <Token>{
      uid: tokenId,
      symbol: getRandomSymbol(),
      name: 'MyToken',
      space: 'myspace',
      status: TokenStatus.PRE_MINTED,
      approved: true,
    };
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: 1000 };
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}/${seller}`)
      .set(distribution);
  });

  it('Should cancel all expired sales', async () => {
    const salesCount = 160;
    const getDummySell = (
      status: TokenTradeOrderStatus,
      type: TokenTradeOrderType,
    ): TokenTradeOrder => ({
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
      const batch = admin.firestore().batch();
      sells.forEach((s) => batch.create(admin.firestore().doc(`${COL.TOKEN_MARKET}/${s.uid}`), s));
      await batch.commit();
      return sells;
    };

    await createSales(TokenTradeOrderStatus.ACTIVE, TokenTradeOrderType.SELL, salesCount);
    await createSales(TokenTradeOrderStatus.SETTLED, TokenTradeOrderType.SELL, 3);

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TOKEN_MARKET)
        .where('owner', '==', seller)
        .where('status', '==', TokenTradeOrderStatus.ACTIVE)
        .get();
      const processed = snap.docs.reduce(
        (sum, act) => sum && (<TokenTradeOrder>act.data()).updatedOn !== undefined,
        true,
      );
      return processed;
    });

    await cancelExpiredSale();

    const snap = await admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', seller)
      .where('status', '==', TokenTradeOrderStatus.EXPIRED)
      .get();
    expect(snap.docs.length).toBe(salesCount);
  });
});
