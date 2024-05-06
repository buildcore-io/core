/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  SUB_COL,
  SYSTEM_CONFIG_DOC_ID,
  TokenPurchase,
  Transaction,
  TransactionType,
} from '@buildcore/interfaces';
import { head } from 'lodash';
import { wait } from '../../test/controls/common';
import { soonTokenId } from '../../test/set-up';
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

  it.each([false, true])(
    'Should not create royalty payments, zero percentage',
    async (isMember: boolean) => {
      if (isMember) {
        await database().doc(COL.MEMBER, helper.seller!).update({ tokenTradingFeePercentage: 0 });
        await database()
          .doc(COL.TOKEN, soonTokenId, SUB_COL.DISTRIBUTION, helper.seller!)
          .upsert({ stakes_dynamic_value: 15000 * MIN_IOTA_AMOUNT });
      } else {
        await database()
          .doc(COL.SYSTEM, SYSTEM_CONFIG_DOC_ID)
          .upsert({ tokenTradingFeePercentage: 0 });
      }

      await helper.createSellTradeOrder(20, MIN_IOTA_AMOUNT);
      await helper.createBuyOrder(20, MIN_IOTA_AMOUNT);

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
      if (isMember) {
        expect(purchase.sellerTier).toBe(4);
        expect(purchase.sellerTokenTradingFeePercentage).toBe(0);
      }

      const billPayments = (
        await database()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.BILL_PAYMENT)
          .where('payload_token', '==', helper.token!.uid)
          .get()
      ).map((d) => <Transaction>d);
      expect(billPayments.length).toBe(2);

      const billPaymentToBuyer = billPayments.find(
        (bp) => Number((head(bp.payload.nativeTokens) as any)?.amount) === 20,
      );
      expect(billPaymentToBuyer).toBeDefined();

      const billPaymentToSeller = billPayments.find(
        (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 20 - billPaymentToBuyer?.payload?.amount!,
      );
      expect(billPaymentToSeller).toBeDefined();

      await awaitTransactionConfirmationsForToken(helper.token!.uid);
    },
  );

  it('Should create royalty payments for different percentage', async () => {
    await database().doc(COL.MEMBER, helper.seller).update({ tokenTradingFeePercentage: 1 });
    await helper.createSellTradeOrder(20, MIN_IOTA_AMOUNT);
    await helper.createBuyOrder(20, MIN_IOTA_AMOUNT);

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
    expect(purchase.sellerTokenTradingFeePercentage).toBe(1);

    const billPayments = (
      await database()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload_token', '==', helper.token!.uid)
        .get()
    ).map((d) => <Transaction>d);
    expect(billPayments.length).toBe(4);

    const billPaymentToSpaceOne = billPayments.find(
      (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 20 * 0.01 * 0.1 + 46800,
    );
    expect(billPaymentToSpaceOne).toBeDefined();

    const billPaymentToSpaceTwo = billPayments.find(
      (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 20 * 0.01 * 0.9 + 46800,
    );
    expect(billPaymentToSpaceTwo).toBeDefined();

    const billPaymentToBuyer = billPayments.find(
      (bp) => Number((head(bp.payload.nativeTokens) as any)?.amount) === 20,
    );
    expect(billPaymentToBuyer).toBeDefined();

    const billPaymentToSeller = billPayments.find(
      (bp) =>
        bp.payload.amount ===
        MIN_IOTA_AMOUNT * 20 * 0.99 -
          billPaymentToSpaceOne?.payload?.storageReturn?.amount! -
          billPaymentToSpaceTwo?.payload?.storageReturn?.amount! -
          billPaymentToBuyer?.payload?.amount!,
    );
    expect(billPaymentToSeller).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });

  it('Should not create royalty payments as percentage is zero, but send dust', async () => {
    await database().doc(COL.MEMBER, helper.seller).update({ tokenTradingFeePercentage: 0 });
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
    expect(billPayments.length).toBe(3);

    const billPaymentToSpaceOne = billPayments.find((bp) => bp.payload.amount === 2 + 46800);
    expect(billPaymentToSpaceOne).toBeDefined();

    const billPaymentToBuyer = billPayments.find(
      (bp) => Number((head(bp.payload.nativeTokens) as any)?.amount) === 20,
    );
    expect(billPaymentToBuyer).toBeDefined();

    const billPaymentToSeller = billPayments.find(
      (bp) =>
        bp.payload.amount ===
        MIN_IOTA_AMOUNT * 20 -
          billPaymentToSpaceOne?.payload?.storageReturn?.amount! -
          billPaymentToBuyer?.payload?.amount!,
    );
    expect(billPaymentToSeller).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
