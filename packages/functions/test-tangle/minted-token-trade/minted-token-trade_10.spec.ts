/* eslint-disable @typescript-eslint/no-explicit-any */

import { COL, MIN_IOTA_AMOUNT, TokenPurchase } from '@build5/interfaces';
import { soonDb } from '../../src/firebase/firestore/soondb';
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

  it('Fulfill buy with lowest sell', async () => {
    await helper.createSellTradeOrder(5, MIN_IOTA_AMOUNT);
    await helper.createSellTradeOrder(5, 2 * MIN_IOTA_AMOUNT);
    await helper.createBuyOrder(5, 2 * MIN_IOTA_AMOUNT);

    const purchaseQuery = soonDb()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length === 1;
    });
    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];

    expect(purchase.count).toBe(5);
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
