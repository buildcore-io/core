/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  Network,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  Transaction,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { cancelExpiredSale } from '../../src/cron/token.cron';
import { getAddress } from '../../src/utils/address.utils';
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

  it('Half fulfill sell and make it expired it', async () => {
    await helper.createBuyOrder(5, MIN_IOTA_AMOUNT);
    await helper.createSellTradeOrder();

    const query = database().collection(COL.TOKEN_MARKET).where('owner', '==', helper.seller);
    await wait(async () => {
      const orders = (await query.get()).map((d) => <TokenTradeOrder>d);
      return orders.length === 1 && orders[0].fulfilled === 5;
    });
    let sell = <TokenTradeOrder>(await query.get())[0];
    await database()
      .doc(COL.TOKEN_MARKET, sell.uid)
      .update({ expiresAt: dayjs().subtract(1, 'd').toDate() });

    await cancelExpiredSale();

    const sellQuery = database().doc(COL.TOKEN_MARKET, sell.uid);
    await wait(async () => {
      sell = <TokenTradeOrder>await sellQuery.get();
      return sell.status === TokenTradeOrderStatus.EXPIRED;
    });

    const credit = <Transaction>(
      await database().doc(COL.TRANSACTION, sell.creditTransactionId!).get()
    );
    expect(credit.member).toBe(helper.seller);
    const seller = <Member>await database().doc(COL.MEMBER, helper.seller!).get();
    expect(credit.payload.targetAddress).toBe(getAddress(seller, Network.RMS));
    expect(credit.payload.amount).toBe(49600);
    expect(credit.payload.nativeTokens![0].amount).toBe(5);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
