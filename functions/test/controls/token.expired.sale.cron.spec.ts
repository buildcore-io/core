import dayjs from 'dayjs';
import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { COL, SUB_COL } from '../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenDistribution, TokenStatus } from "../../interfaces/models/token";
import admin from '../../src/admin.config';
import { cancelExpiredSale } from '../../src/cron/token.cron';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { projectId, testEnv } from '../set-up';
import { createMember, wait } from "./common";

let walletSpy: any;

describe('Expired sales cron', () => {
  let seller: string;

  let token: Token

  beforeEach(async () => {
    if (process.env.LOCAL_TEST) {
      await testEnv.firestore.clearFirestoreData({ projectId })
    }
    walletSpy = jest.spyOn(wallet, 'decodeAuth');
    seller = await createMember(walletSpy, true)

    const tokenId = wallet.getRandomEthAddress()
    token = <Token>{ uid: tokenId, symbol: 'MYWO', name: 'MyToken', space: 'myspace', status: TokenStatus.PRE_MINTED, approved: true }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}`).set(token);
    const distribution = <TokenDistribution>{ tokenOwned: 1000 }
    await admin.firestore().doc(`${COL.TOKEN}/${tokenId}/${SUB_COL.DISTRIBUTION}/${seller}`).set(distribution);
  });

  it('Should cancel all expired sales', async () => {
    const salesCount = 160
    const getDummySell = (status: TokenBuySellOrderStatus, type: TokenBuySellOrderType): TokenBuySellOrder => ({
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
    })
    const createSales = (status: TokenBuySellOrderStatus, type: TokenBuySellOrderType, count: number) =>
      Array.from(Array(count)).map(async () => {
        const sell = getDummySell(status, type);
        await admin.firestore().doc(`${COL.TOKEN_MARKET}/${sell.uid}`).create(sell)
        return sell;
      })

    await Promise.all(createSales(TokenBuySellOrderStatus.ACTIVE, TokenBuySellOrderType.SELL, salesCount))
    await Promise.all(createSales(TokenBuySellOrderStatus.SETTLED, TokenBuySellOrderType.SELL, 3))

    await wait(async () => {
      const snap = await admin.firestore().collection(COL.TOKEN_MARKET)
        .where('owner', '==', seller)
        .where('status', '==', TokenBuySellOrderStatus.ACTIVE)
        .get()
      const processed = snap.docs.reduce((sum, act) => sum && (<TokenBuySellOrder>act.data()).updatedOn !== undefined, true)
      return processed
    })

    await cancelExpiredSale()

    const snap = await admin.firestore().collection(COL.TOKEN_MARKET)
      .where('owner', '==', seller)
      .where('status', '==', TokenBuySellOrderStatus.EXPIRED).get()
    expect(snap.docs.length).toBe(salesCount)
  })
})
