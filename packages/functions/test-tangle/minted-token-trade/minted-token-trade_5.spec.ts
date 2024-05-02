/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  CreditPaymentReason,
  MIN_IOTA_AMOUNT,
  TokenTradeOrder,
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

  it('Create and cancel buy', async () => {
    await helper.createBuyOrder();

    const query = database().collection(COL.TOKEN_MARKET).where('owner', '==', helper.buyer);
    const buy = <TokenTradeOrder>(await query.get())[0];
    mockWalletReturnValue(helper.buyer!, { uid: buy.uid });
    await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.cancelTradeOrder);

    const buyerCreditnap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.buyer)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(buyerCreditnap.length).toBe(1);
    expect(buyerCreditnap[0]?.payload?.amount).toBe(10 * MIN_IOTA_AMOUNT);
    expect(buyerCreditnap[0]?.payload?.reason).toBe(CreditPaymentReason.TRADE_CANCELLED);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
