/* eslint-disable @typescript-eslint/no-explicit-any */

import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  MIN_IOTA_AMOUNT,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import admin from '../../src/admin.config';
import { tradeToken } from '../../src/runtime/firebase/token/trading';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { dummyTokenId, Helper, MINTED_TOKEN_ID, saveToken } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.berforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should create credit, order received different token', async () => {
    const dummyToken = await saveToken(
      helper.space!.uid,
      helper.guardian!,
      helper.walletService!,
      dummyTokenId,
    );
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      symbol: dummyToken.symbol,
      count: 10,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder = await testEnv.wrap(tradeToken)({});
    await helper.walletService!.send(helper.sellerAddress!, sellOrder.payload.targetAddress, 0, {
      nativeTokens: [
        { amount: HexHelper.fromBigInt256(bigInt(10)), id: helper.token!.mintingData?.tokenId! },
      ],
    });

    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.seller);
    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1;
    });
    const snap = await query.get();
    const credit = <Transaction>snap.docs[0].data();
    expect(credit.payload.amount).toBe(sellOrder.payload.amount);
    expect(credit.payload.nativeTokens[0].id).toBe(MINTED_TOKEN_ID);
    expect(credit.payload.nativeTokens[0].amount).toBe(10);
    const sellSnap = await admin
      .firestore()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller)
      .get();
    expect(sellSnap.docs.length).toBe(0);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
