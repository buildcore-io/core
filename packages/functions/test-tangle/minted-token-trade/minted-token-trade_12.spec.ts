/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  Transaction,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { cancelExpiredSale } from '../../src/cron/token.cron';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
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

  it('Half fulfill buy and make it expired it', async () => {
    await helper.createSellTradeOrder(5, MIN_IOTA_AMOUNT);
    await helper.createBuyOrder();

    const query = build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer);
    await wait(async () => {
      const orders = (await query.get()).map((d) => <TokenTradeOrder>d);
      return orders.length === 1 && orders[0].fulfilled === 5;
    });
    let buy = <TokenTradeOrder>(await query.get())[0];
    await build5Db()
      .doc(`${COL.TOKEN_MARKET}/${buy.uid}`)
      .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'd').toDate()) });

    await cancelExpiredSale();

    const buyQuery = build5Db().doc(`${COL.TOKEN_MARKET}/${buy.uid}`);
    await wait(async () => {
      buy = <TokenTradeOrder>await buyQuery.get();
      return buy.status === TokenTradeOrderStatus.EXPIRED;
    });

    const credit = <Transaction>(
      await build5Db().doc(`${COL.TRANSACTION}/${buy.creditTransactionId}`).get()
    );
    expect(credit.member).toBe(helper.buyer);
    const buyer = <Member>await build5Db().doc(`${COL.MEMBER}/${helper.buyer!}`).get();
    expect(credit.payload.targetAddress).toBe(getAddress(buyer, Network.RMS));
    expect(credit.payload.amount).toBe(5 * MIN_IOTA_AMOUNT);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });

  it('Half fulfill sell and make it expired it', async () => {
    await helper.createBuyOrder(5, MIN_IOTA_AMOUNT);
    await helper.createSellTradeOrder();

    const query = build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', helper.seller);
    await wait(async () => {
      const orders = (await query.get()).map((d) => <TokenTradeOrder>d);
      return orders.length === 1 && orders[0].fulfilled === 5;
    });
    let sell = <TokenTradeOrder>(await query.get())[0];
    await build5Db()
      .doc(`${COL.TOKEN_MARKET}/${sell.uid}`)
      .update({ expiresAt: dateToTimestamp(dayjs().subtract(1, 'd').toDate()) });

    await cancelExpiredSale();

    const sellQuery = build5Db().doc(`${COL.TOKEN_MARKET}/${sell.uid}`);
    await wait(async () => {
      sell = <TokenTradeOrder>await sellQuery.get();
      return sell.status === TokenTradeOrderStatus.EXPIRED;
    });

    const credit = <Transaction>(
      await build5Db().doc(`${COL.TRANSACTION}/${sell.creditTransactionId}`).get()
    );
    expect(credit.member).toBe(helper.seller);
    const seller = <Member>await build5Db().doc(`${COL.MEMBER}/${helper.seller!}`).get();
    expect(credit.payload.targetAddress).toBe(getAddress(seller, Network.RMS));
    expect(credit.payload.amount).toBe(49600);
    expect(credit.payload.nativeTokens[0].amount).toBe(5);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
