/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  CreditPaymentReason,
  MIN_IOTA_AMOUNT,
  TokenTradeOrder,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { cancelTradeOrder } from '../../src/runtime/firebase/token/trading';
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

    const query = build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer);
    const buy = <TokenTradeOrder>(await query.get())[0];
    mockWalletReturnValue(helper.walletSpy, helper.buyer!, { uid: buy.uid });
    await testEnv.wrap(cancelTradeOrder)({});

    const buyerCreditnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer)
      .where('type', '==', TransactionType.CREDIT)
      .get<Transaction>();
    expect(buyerCreditnap.length).toBe(1);
    expect(buyerCreditnap[0]?.payload?.amount).toBe(10 * MIN_IOTA_AMOUNT);
    expect(buyerCreditnap[0]?.payload?.reason).toBe(CreditPaymentReason.TRADE_CANCELLED);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
