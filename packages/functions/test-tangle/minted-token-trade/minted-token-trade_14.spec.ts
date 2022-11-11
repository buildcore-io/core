/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  MIN_IOTA_AMOUNT,
  TokenPurchase,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import { head } from 'lodash';
import admin from '../../src/admin.config';
import { wait } from '../../test/controls/common';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestMintedTokenFromFaucet } from '../faucet';
import { Helper, VAULT_MNEMONIC } from './Helper';

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

    const billPaymentToSpaceOne = billPayments.find(
      (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 20 * 0.025 * 0.1 + 2 + 46800,
    );
    expect(billPaymentToSpaceOne).toBeDefined();

    const billPaymentToSpaceTwo = billPayments.find(
      (bp) => bp.payload.amount === MIN_IOTA_AMOUNT * 20 * 0.025 * 0.9 + 46800,
    );
    expect(billPaymentToSpaceTwo).toBeDefined();

    const billPaymentToBuyer = billPayments.find(
      (bp) => (head(bp.payload.nativeTokens) as any)?.amount === 20,
    );
    expect(billPaymentToBuyer).toBeDefined();

    const billPaymentToSeller = billPayments.find(
      (bp) =>
        bp.payload.amount ===
        MIN_IOTA_AMOUNT * 20 * 0.975 -
          billPaymentToSpaceOne?.payload?.storageReturn?.amount! -
          billPaymentToSpaceTwo?.payload?.storageReturn?.amount! -
          billPaymentToBuyer?.payload?.amount,
    );
    expect(billPaymentToSeller).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });

  it('Should not fill buy, balance would be less then MIN_IOTA_AMOUNT and order not fulfilled', async () => {
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      helper.sellerAddress!,
      helper.token!.mintingData?.tokenId!,
      VAULT_MNEMONIC,
      180,
    );

    await helper.createSellTradeOrder(199, MIN_IOTA_AMOUNT / 100);
    await helper.createBuyOrder(200, MIN_IOTA_AMOUNT / 100);

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const purchase = await admin
      .firestore()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', helper.token!.uid)
      .get();
    expect(purchase.size).toBe(0);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
