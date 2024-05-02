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

  it('Half fulfill buy and make it expired it', async () => {
    await helper.createSellTradeOrder(5, MIN_IOTA_AMOUNT);
    await helper.createBuyOrder();

    const query = database().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer);
    await wait(async () => {
      const orders = (await query.get()).map((d) => <TokenTradeOrder>d);
      return orders.length === 1 && orders[0].fulfilled === 5;
    });
    let buy = <TokenTradeOrder>(await query.get())[0];
    await database()
      .doc(COL.TOKEN_MARKET, buy.uid)
      .update({ expiresAt: dayjs().subtract(1, 'd').toDate() });

    await cancelExpiredSale();

    const buyQuery = database().doc(COL.TOKEN_MARKET, buy.uid);
    await wait(async () => {
      buy = <TokenTradeOrder>await buyQuery.get();
      return buy.status === TokenTradeOrderStatus.EXPIRED;
    });

    const credit = <Transaction>(
      await database().doc(COL.TRANSACTION, buy.creditTransactionId!).get()
    );
    expect(credit.member).toBe(helper.buyer);
    const buyer = <Member>await database().doc(COL.MEMBER, helper.buyer!).get();
    expect(credit.payload.targetAddress).toBe(getAddress(buyer, Network.RMS));
    expect(credit.payload.amount).toBe(5 * MIN_IOTA_AMOUNT);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
