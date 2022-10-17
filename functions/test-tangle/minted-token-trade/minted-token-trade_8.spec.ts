/* eslint-disable @typescript-eslint/no-explicit-any */

import { MIN_IOTA_AMOUNT } from '../../interfaces/config';
import { WenError } from '../../interfaces/errors';
import { TokenTradeOrderType } from '../../interfaces/models';
import { COL } from '../../interfaces/models/base';
import admin from '../../src/admin.config';
import { tradeToken } from '../../src/controls/token-trading/token-trade.controller';
import { expectThrow, mockWalletReturnValue } from '../../test/controls/common';
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

  it('Should create sell order, not approved, but public', async () => {
    // Should throw at sell, not approved, not public
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token!.uid}`)
      .update({ approved: false, public: false });
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      token: helper.token!.uid,
      count: 10,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.token_not_approved.key);

    // Should throw at buy, not approved, not public
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token!.uid}`)
      .update({ approved: false, public: false });
    mockWalletReturnValue(helper.walletSpy, helper.buyer!, {
      token: helper.token!.uid,
      count: 5,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.BUY,
    });
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.token_not_approved.key);

    // Should create sell order, not approved, but public
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token!.uid}`)
      .update({ approved: false, public: true });
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      token: helper.token!.uid,
      count: 10,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.SELL,
    });
    expect(await testEnv.wrap(tradeToken)({})).toBeDefined();

    // Should create buy order, not approved, but public'
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token!.uid}`)
      .update({ approved: false, public: true });
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      token: helper.token!.uid,
      count: 10,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.BUY,
    });
    expect(await testEnv.wrap(tradeToken)({})).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
