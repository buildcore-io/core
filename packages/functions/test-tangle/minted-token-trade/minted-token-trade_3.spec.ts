/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Timestamp,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';

import { build5Db } from '@build-5/database';
import dayjs from 'dayjs';
import { cancelExpiredSale } from '../../src/cron/token.cron';
import { tradeToken } from '../../src/runtime/firebase/token/trading';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.berforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Fulfill sell with two buys', async () => {
    await helper.createBuyOrder(5, MIN_IOTA_AMOUNT);
    await helper.createBuyOrder(5, MIN_IOTA_AMOUNT);
    await helper.createSellTradeOrder();

    await wait(async () => {
      const orders = (
        await build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer).get()
      ).map((d) => <TokenTradeOrder>d);
      const fulfilled = orders.filter((o) => o.count === o.fulfilled);
      return fulfilled.length === orders.length;
    });

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });

  it.each([TokenTradeOrderType.SELL, TokenTradeOrderType.BUY])(
    'Should create trade order order with expiration from expiration unlock',
    async (type: TokenTradeOrderType) => {
      const date = dayjs().add(2, 'm').millisecond(0).toDate();
      const expiresAt = dateToTimestamp(date);

      if (type === TokenTradeOrderType.SELL) {
        await helper.createSellTradeOrder(10, MIN_IOTA_AMOUNT, expiresAt);
      } else {
        await helper.createBuyOrder(10, MIN_IOTA_AMOUNT, expiresAt);
      }

      const member = <Member>await build5Db()
        .doc(`${COL.MEMBER}/${type === TokenTradeOrderType.SELL ? helper.seller! : helper.buyer!}`)
        .get();

      const tradeQuery = build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', member.uid);
      await wait(async () => {
        const snap = await tradeQuery.get();
        return snap.length === 1;
      });
      const trade = <TokenTradeOrder>(await tradeQuery.get())[0];
      expect(dayjs(trade.expiresAt.toDate()).isSame(dayjs(expiresAt.toDate()))).toBe(true);

      await build5Db()
        .doc(`${COL.TOKEN_MARKET}/${trade.uid}`)
        .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'm').toDate()) });
      await cancelExpiredSale();

      await wait(async () => {
        const snap = await build5Db()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.CREDIT)
          .where('member', '==', member.uid)
          .get<Transaction>();
        return (
          snap.length === 1 && snap[0]!.payload.targetAddress === getAddress(member, helper.network)
        );
      });
    },
  );

  it('Should credit buy order with expiration unlock, wrong amount', async () => {
    const date = dayjs().add(2, 'h').millisecond(0).toDate();
    const expiresAt = dateToTimestamp(date) as Timestamp;

    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      symbol: helper.token!.symbol,
      count: 10,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder: Transaction = await testEnv.wrap(tradeToken)({});
    await build5Db()
      .doc(`${COL.TRANSACTION}/${sellOrder.uid}`)
      .update({ 'payload.expiresOn': dateToTimestamp(dayjs().subtract(2, 'h').toDate()) });

    await helper.walletService!.send(helper.sellerAddress!, sellOrder.payload.targetAddress!, 0, {
      nativeTokens: [{ amount: BigInt(10), id: helper.token!.mintingData?.tokenId! }],
      expiration: expiresAt
        ? {
            expiresAt,
            returnAddressBech32: helper.sellerAddress!.bech32,
          }
        : undefined,
    });

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', helper.seller)
        .get<Transaction>();
      return (
        snap.length === 1 &&
        snap[0]!.payload.walletReference?.confirmed &&
        snap[0]!.payload.targetAddress === helper.sellerAddress!.bech32
      );
    });
  });
});
