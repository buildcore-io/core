/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { tradeToken } from '../../src/runtime/firebase/token/trading';
import { packBasicOutput } from '../../src/utils/basic-output.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { Helper, MINTED_TOKEN_ID, dummyTokenId, saveToken } from './Helper';

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
      nativeTokens: [{ amount: BigInt(10), id: helper.token!.mintingData?.tokenId! }],
    });

    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.seller);
    await wait(async () => {
      const snap = await query.get();
      return snap.length === 1;
    });
    const snap = await query.get();
    const credit = <Transaction>snap[0];
    const output = await packBasicOutput(
      helper.walletService!,
      sellOrder.payload.targetAddress,
      0,
      {
        nativeTokens: [{ amount: BigInt(10), id: helper.token!.mintingData?.tokenId! }],
      },
    );
    expect(credit.payload.amount).toBe(Number(output.amount));
    expect(credit.payload.nativeTokens![0].id).toBe(MINTED_TOKEN_ID);
    expect(credit.payload.nativeTokens![0].amount).toBe(10);
    const sellSnap = await build5Db()
      .collection(COL.TOKEN_MARKET)
      .where('owner', '==', helper.seller)
      .get();
    expect(sellSnap.length).toBe(0);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
