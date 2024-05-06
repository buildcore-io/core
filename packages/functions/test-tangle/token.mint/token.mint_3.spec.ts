/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
  WEN_FUNC,
  WenError,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { expectThrow, submitMilestoneFunc, wait } from '../../test/controls/common';
import { mockWalletReturnValue, testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  it('Should cancel all active buys', async () => {
    await helper.setup();
    const request = {
      symbol: helper.token.symbol,
      price: MIN_IOTA_AMOUNT,
      count: 5,
      type: TokenTradeOrderType.BUY,
    };
    mockWalletReturnValue(helper.guardian.uid, request);

    const order = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await submitMilestoneFunc(order);

    const order2 = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await submitMilestoneFunc(order2);

    await wait(async () => {
      const buySnap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('owner', '==', helper.guardian.uid)
        .get();
      return buySnap.length === 2;
    });

    mockWalletReturnValue(helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const mintOrder = await testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder);
    await requestFundsFromFaucet(
      helper.network,
      mintOrder.payload.targetAddress,
      mintOrder.payload.amount,
    );

    const tokenDocRef = database().doc(COL.TOKEN, helper.token.uid);
    await wait(async () => {
      const snap = await tokenDocRef.get();
      return snap?.status === TokenStatus.MINTING;
    });

    await wait(async () => {
      const buySnap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.BUY)
        .where('status', '==', TokenTradeOrderStatus.CANCELLED_MINTING_TOKEN)
        .where('owner', '==', helper.guardian.uid)
        .get();
      return buySnap.length === 2;
    });

    await wait(async () => {
      const creditSnap = await database()
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
    mockWalletReturnValue(helper.member, request);
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);

    mockWalletReturnValue(helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const mintOrder = await testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder);
    await requestFundsFromFaucet(
      helper.network,
      mintOrder.payload.targetAddress,
      mintOrder.payload.amount,
    );

    await wait(async () => {
      const snap = await database().doc(COL.TOKEN, helper.token.uid).get();
      return snap?.status === TokenStatus.MINTING;
    });

    await wait(async () => {
      const sellSnap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('type', '==', TokenTradeOrderType.SELL)
        .where('status', '==', TokenTradeOrderStatus.CANCELLED_MINTING_TOKEN)
        .where('owner', '==', helper.member)
        .get();
      return sellSnap.length === 2;
    });

    const distribution = <TokenDistribution>(
      await database().doc(COL.TOKEN, helper.token.uid, SUB_COL.DISTRIBUTION, helper.member).get()
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
    await database()
      .doc(COL.TOKEN, helper.token.uid)
      .update({
        allocations: JSON.stringify([{ title: 'public', percentage: 100, isPublicSale: true }]),
      });
    const updateData = { token: helper.token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(helper.guardian.uid, updateData);
    let token = await testEnv.wrap<Token>(WEN_FUNC.setTokenAvailableForSale);
    token = (await database().doc(COL.TOKEN, token.uid).get())!;
    expect(token.saleStartDate?.toDate()).toEqual(
      dateToTimestamp(dayjs(publicTime.saleStartDate), true).toDate(),
    );

    mockWalletReturnValue(helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    await expectThrow(
      testEnv.wrap<Transaction>(WEN_FUNC.mintTokenOrder),
      WenError.can_not_mint_in_pub_sale.key,
    );
  });
});
