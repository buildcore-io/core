/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { setTokenAvailableForSale } from '../../src/runtime/firebase/token/base';
import { mintTokenOrder } from '../../src/runtime/firebase/token/minting';
import { tradeToken } from '../../src/runtime/firebase/token/trading';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import {
  expectThrow,
  milestoneProcessed,
  mockWalletReturnValue,
  submitMilestoneFunc,
  wait,
} from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should cancel all active buys', async () => {
    await helper.setup();
    const request = {
      symbol: helper.token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.BUY,
    };
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, request);

    const order = await testEnv.wrap(tradeToken)({});
    const milestone = await submitMilestoneFunc(order.payload.targetAddress, order.payload.amount);
    await milestoneProcessed(milestone.milestone, milestone.tranId);

    const order2 = await testEnv.wrap(tradeToken)({});
    const milestone2 = await submitMilestoneFunc(
      order2.payload.targetAddress,
      order2.payload.amount,
    );
    await milestoneProcessed(milestone2.milestone, milestone2.tranId);

    await wait(async () => {
      const buySnap = await build5Db()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('owner', '==', helper.guardian.uid)
        .get();
      return buySnap.length === 2;
    });

    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const mintOrder = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      mintOrder.payload.targetAddress,
      mintOrder.payload.amount,
    );

    const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${helper.token.uid}`);
    await wait(async () => {
      const snap = await tokenDocRef.get<Token>();
      return snap?.status === TokenStatus.MINTING;
    });

    await wait(async () => {
      const buySnap = await build5Db()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('status', '==', TokenTradeOrderStatus.CANCELLED_MINTING_TOKEN)
        .where('owner', '==', helper.guardian.uid)
        .get();
      return buySnap.length === 2;
    });

    await wait(async () => {
      const creditSnap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', helper.guardian.uid)
        .get();
      return creditSnap.length === 2;
    });
  });

  it('Should cancel all active sells', async () => {
    await helper.setup();

    const request = {
      symbol: helper.token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 500,
      type: TokenTradeOrderType.SELL,
    };
    mockWalletReturnValue(helper.walletSpy, helper.member, request);
    await testEnv.wrap(tradeToken)({});
    await testEnv.wrap(tradeToken)({});

    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const mintOrder = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      mintOrder.payload.targetAddress,
      mintOrder.payload.amount,
    );

    await wait(async () => {
      const snap = await build5Db().doc(`${COL.TOKEN}/${helper.token.uid}`).get<Token>();
      return snap?.status === TokenStatus.MINTING;
    });

    await wait(async () => {
      const sellSnap = await build5Db()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.SELL)
        .where('status', '==', TokenTradeOrderStatus.CANCELLED_MINTING_TOKEN)
        .where('owner', '==', helper.member)
        .get();
      return sellSnap.length === 2;
    });

    const distribution = <TokenDistribution>(
      await build5Db()
        .doc(`${COL.TOKEN}/${helper.token.uid}/${SUB_COL.DISTRIBUTION}/${helper.member}`)
        .get()
    );
    expect(distribution.lockedForSale).toBe(0);
    expect(distribution.tokenOwned).toBe(1000);
  });

  it('Should throw, can not mint token before or during public sale', async () => {
    await helper.setup();
    const publicTime = {
      saleStartDate: dayjs().add(2, 'd').toDate(),
      saleLength: 86400000 * 2,
      coolDownLength: 86400000,
    };
    await build5Db()
      .doc(`${COL.TOKEN}/${helper.token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    const updateData = { token: helper.token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, updateData);
    const result = await testEnv.wrap(setTokenAvailableForSale)({});
    expect(result?.saleStartDate.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );

    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.can_not_mint_in_pub_sale.key);
  });
});
