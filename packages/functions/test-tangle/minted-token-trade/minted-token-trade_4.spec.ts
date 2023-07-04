/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  CreditPaymentReason,
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

  it('Create and cancel sell', async () => {
    await helper.createSellTradeOrder();

    const query = build5Db().collection(COL.TOKEN_MARKET).where('owner', '==', helper.seller);
    const sell = <TokenTradeOrder>(await query.get())[0];
    mockWalletReturnValue(helper.walletSpy, helper.seller!, { uid: sell.uid });
    await testEnv.wrap(cancelTradeOrder)({});

    const sellerCreditSnap = await build5Db()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(sellerCreditSnap.length).toBe(1);
    const sellerCredit = sellerCreditSnap[0] as Transaction;
    expect(sellerCredit.payload.amount).toBe(49600);
    expect(sellerCredit.payload.nativeTokens![0].amount).toBe('10');
    expect(sellerCredit.payload.reason).toBe(CreditPaymentReason.TRADE_CANCELLED);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
