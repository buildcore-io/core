/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  CreditPaymentReason,
  MIN_IOTA_AMOUNT,
  TokenTradeOrder,
  TransactionType,
} from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { cancelTradeOrder } from '../../src/controls/token-trading/token-trade-cancel.controller';
import { mockWalletReturnValue } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
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

  it('Create and cancel buy', async () => {
    await helper.createBuyOrder();

    const query = admin.firestore().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer);
    const buy = <TokenTradeOrder>(await query.get()).docs[0].data();
    mockWalletReturnValue(helper.walletSpy, helper.buyer!, { uid: buy.uid });
    await testEnv.wrap(cancelTradeOrder)({});

    const buyerCreditnap = await admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(buyerCreditnap.size).toBe(1);
    expect(buyerCreditnap.docs[0].data()?.payload?.amount).toBe(10 * MIN_IOTA_AMOUNT);
    expect(buyerCreditnap.docs[0].data()?.payload?.reason).toBe(
      CreditPaymentReason.TRADE_CANCELLED,
    );

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
