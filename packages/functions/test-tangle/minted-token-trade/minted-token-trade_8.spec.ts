/* eslint-disable @typescript-eslint/no-explicit-any */

import { COL, MIN_IOTA_AMOUNT, TokenTradeOrderType, WenError } from '@build-5/interfaces';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { tradeToken } from '../../src/runtime/firebase/token/trading';
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
    await build5Db()
      .doc(`${COL.TOKEN}/${helper.token!.uid}`)
      .update({ approved: false, public: false });
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      symbol: helper.token!.symbol,
      count: 10,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.SELL,
    });
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.token_does_not_exist.key);

    // Should throw at buy, not approved, not public
    await build5Db()
      .doc(`${COL.TOKEN}/${helper.token!.uid}`)
      .update({ approved: false, public: false });
    mockWalletReturnValue(helper.walletSpy, helper.buyer!, {
      symbol: helper.token!.symbol,
      count: 5,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.BUY,
    });
    await expectThrow(testEnv.wrap(tradeToken)({}), WenError.token_does_not_exist.key);

    // Should create sell order, not approved, but public
    await build5Db()
      .doc(`${COL.TOKEN}/${helper.token!.uid}`)
      .update({ approved: false, public: true });
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      symbol: helper.token!.symbol,
      count: 10,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.SELL,
    });
    expect(await testEnv.wrap(tradeToken)({})).toBeDefined();

    // Should create buy order, not approved, but public'
    await build5Db()
      .doc(`${COL.TOKEN}/${helper.token!.uid}`)
      .update({ approved: false, public: true });
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      symbol: helper.token!.symbol,
      count: 10,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.BUY,
    });
    expect(await testEnv.wrap(tradeToken)({})).toBeDefined();

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
