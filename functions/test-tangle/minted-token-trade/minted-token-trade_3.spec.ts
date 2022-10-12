/* eslint-disable @typescript-eslint/no-explicit-any */

import dayjs from 'dayjs';
import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { TokenTradeOrder } from '../../interfaces/models';
import { COL, Timestamp } from '../../interfaces/models/base';
import admin from '../../src/admin.config';
import { wait } from '../../test/controls/common';
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
        await admin
          .firestore()
          .collection(COL.TOKEN_MARKET)
          .where('owner', '==', helper.buyer)
          .get()
      ).docs.map((d) => <TokenTradeOrder>d.data());
      const fulfilled = orders.filter((o) => o.count === o.fulfilled);
      return fulfilled.length === orders.length;
    });

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });

  it('Should create sell order with expiration from expiration unlock', async () => {
    const date = dayjs().add(2, 'h').millisecond(0).toDate();
    const expiresAt = admin.firestore.Timestamp.fromDate(date) as Timestamp;

    await helper.createSellTradeOrder(10, MIN_IOTA_AMOUNT, expiresAt);

    const sellQuery = admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller!);
    await wait(async () => {
      const snap = await sellQuery.get();
      return snap.size !== 0;
    });
    const sell = <TokenTradeOrder>(await sellQuery.get()).docs[0].data();
    expect(dayjs(sell.expiresAt.toDate()).isSame(dayjs(expiresAt.toDate()))).toBe(true);
  });

  afterAll(async () => {
    await helper.listener!.cancel();
  });
});
