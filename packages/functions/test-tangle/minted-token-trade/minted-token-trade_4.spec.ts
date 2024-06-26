/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  CreditPaymentReason,
  TokenTradeOrder,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
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

    const query = database().collection(COL.TOKEN_MARKET).where('owner', '==', helper.seller);
    const sell = <TokenTradeOrder>(await query.get())[0];
    mockWalletReturnValue(helper.seller!, { uid: sell.uid });
    await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.cancelTradeOrder);

    const sellerCreditSnap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(sellerCreditSnap.length).toBe(1);
    const sellerCredit = sellerCreditSnap[0] as Transaction;
    expect(sellerCredit.payload.amount).toBe(49600);
    expect(sellerCredit.payload.nativeTokens![0].amount).toBe(10);
    expect(sellerCredit.payload.reason).toBe(CreditPaymentReason.TRADE_CANCELLED);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
