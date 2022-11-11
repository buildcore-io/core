/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  MIN_IOTA_AMOUNT,
  SYSTEM_CONFIG_DOC_ID,
  TokenPurchase,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import { head } from 'lodash';
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

  it.each([false, true])(
    'Should not create royalty payments, zero percentage',
    async (isMember: boolean) => {
      if (isMember) {
        await admin
          .firestore()
          .doc(`${COL.MEMBER}/${helper.seller}`)
          .update({ tokenTradingFeePercentage: 0 });
      } else {
        await admin
          .firestore()
          .doc(`${COL.SYSTEM}/${SYSTEM_CONFIG_DOC_ID}`)
          .set({ tokenTradingFeePercentage: 0 });
      }

      await helper.createSellTradeOrder(20, MIN_IOTA_AMOUNT);
      await helper.createBuyOrder(20, MIN_IOTA_AMOUNT);

      const purchaseQuery = admin
        .firestore()
        .collection(COL.TOKEN_PURCHASE)
        .where('token', '==', helper.token!.uid);
      await wait(async () => {
        const snap = await purchaseQuery.get();
        return snap.docs.length === 1;
      });

      const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data();
      expect(purchase.count).toBe(20);
      expect(purchase.price).toBe(MIN_IOTA_AMOUNT);

      const billPayments = (
        await admin
          .firestore()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.BILL_PAYMENT)
          .where('payload.token', '==', helper.token!.uid)
          .get()
      ).docs.map((d) => <Transaction>d.data());
      expect(billPayments.length).toBe(2);

      const billPaymentToBuyer = billPayments.find(
        (bp) => (head(bp.payload.nativeTokens) as any)?.amount === 20,
      );
      expect(billPaymentToBuyer).toBeDefined();

      const billPaymentToSeller = billPayments.find(
        (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 20 - billPaymentToBuyer?.payload?.amount,
      );
      expect(billPaymentToSeller).toBeDefined();

      await awaitTransactionConfirmationsForToken(helper.token!.uid);
    },
  );

  it('Should create royalty payments for different percentage', async () => {
    await admin
      .firestore()
      .doc(`${COL.MEMBER}/${helper.seller}`)
      .update({ tokenTradingFeePercentage: 1 });
    await helper.createSellTradeOrder(20, MIN_IOTA_AMOUNT);
    await helper.createBuyOrder(20, MIN_IOTA_AMOUNT);

    const purchaseQuery = admin
      .firestore()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.docs.length === 1;
    });

    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data();
    expect(purchase.count).toBe(20);
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT);

    const billPayments = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload.token', '==', helper.token!.uid)
        .get()
    ).docs.map((d) => <Transaction>d.data());
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
      (bp) => (head(bp.payload.nativeTokens) as any)?.amount === 20,
    );
    expect(billPaymentToBuyer).toBeDefined();

    const billPaymentToSeller = billPayments.find(
      (bp) =>
        bp.payload.amount ===
        MIN_IOTA_AMOUNT * 20 * 0.99 -
          billPaymentToSpaceOne?.payload?.storageReturn?.amount! -
          billPaymentToSpaceTwo?.payload?.storageReturn?.amount! -
          billPaymentToBuyer?.payload?.amount,
    );
    expect(billPaymentToSeller).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });

  it('Should not create royalty payments as percentage is zero, but send dust', async () => {
    await admin
      .firestore()
      .doc(`${COL.MEMBER}/${helper.seller}`)
      .update({ tokenTradingFeePercentage: 0 });
    await helper.createSellTradeOrder(20, MIN_IOTA_AMOUNT);
    await helper.createBuyOrder(20, MIN_IOTA_AMOUNT + 0.1);

    const purchaseQuery = admin
      .firestore()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token!.uid);
    await wait(async () => {
      const snap = await purchaseQuery.get();
      return snap.docs.length === 1;
    });

    const purchase = <TokenPurchase>(await purchaseQuery.get()).docs[0].data();
    expect(purchase.count).toBe(20);
    expect(purchase.price).toBe(MIN_IOTA_AMOUNT);

    const billPayments = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('payload.token', '==', helper.token!.uid)
        .get()
    ).docs.map((d) => <Transaction>d.data());
    expect(billPayments.length).toBe(3);

    const billPaymentToSpaceOne = billPayments.find((bp) => bp.payload.amount === 2 + 46800);
    expect(billPaymentToSpaceOne).toBeDefined();

    const billPaymentToBuyer = billPayments.find(
      (bp) => (head(bp.payload.nativeTokens) as any)?.amount === 20,
    );
    expect(billPaymentToBuyer).toBeDefined();

    const billPaymentToSeller = billPayments.find(
      (bp) =>
        bp.payload.amount ===
        MIN_IOTA_AMOUNT * 20 -
          billPaymentToSpaceOne?.payload?.storageReturn?.amount! -
          billPaymentToBuyer?.payload?.amount,
    );
    expect(billPaymentToSeller).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
