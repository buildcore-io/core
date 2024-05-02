/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  TokenPurchase,
  Transaction,
  TransactionType,
} from '@buildcore/interfaces';
import { head } from 'lodash';
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

  it('Should send dust to space', async () => {
    await helper.createSellTradeOrder(20, MIN_IOTA_AMOUNT);
    await helper.createBuyOrder(20, MIN_IOTA_AMOUNT + 0.1);

    const purchaseQuery = database()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.length === 1;
    });

    const purchase = <TokenPurchase>(await purchaseQuery.get())[0];
    expect(purchase.count).toBe(20);
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT);

    const billPayments = (
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload_token', '==', helper.token!.uid)
        .get()
    ).map((d) => <Transaction>d);

    const billPaymentToSpaceOne = billPayments.find(
      (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 20 * 0.025 * 0.1 + 2 + 46800,
    );
    expect(billPaymentToSpaceOne).toBeDefined();

    const billPaymentToSpaceTwo = billPayments.find(
      (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 20 * 0.025 * 0.9 + 46800,
    );
    expect(billPaymentToSpaceTwo).toBeDefined();

    const billPaymentToBuyer = billPayments.find(
      (bp) => Number(head(bp.payload.nativeTokens)?.amount) === 20,
    );
    expect(billPaymentToBuyer).toBeDefined();

    const billPaymentToSeller = billPayments.find(
      (bp) =>
        bp.payload.amount ===
        MIN_IOTA_AMOUNT * 20 * 0.975 -
          billPaymentToSpaceOne?.payload?.storageReturn?.amount! -
          billPaymentToSpaceTwo?.payload?.storageReturn?.amount! -
          billPaymentToBuyer?.payload?.amount!,
    );
    expect(billPaymentToSeller).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
