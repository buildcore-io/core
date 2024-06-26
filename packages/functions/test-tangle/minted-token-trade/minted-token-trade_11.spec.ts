/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import { COL, MIN_IOTA_AMOUNT, TokenPurchase } from '@buildcore/interfaces';
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

  it('Fulfill sell with highest buy', async () => {
    await helper.createBuyOrder(5, MIN_IOTA_AMOUNT);
    await helper.createBuyOrder(5, 2 * MIN_IOTA_AMOUNT);
    await helper.createSellTradeOrder(5, MIN_IOTA_AMOUNT);

    const purchaseQuery = database()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length === 1;
    });
    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];

    expect(purchase.count).toBe(5);
    expect(purchase.price).toBe(2 * MIN_IOTA_AMOUNT);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
