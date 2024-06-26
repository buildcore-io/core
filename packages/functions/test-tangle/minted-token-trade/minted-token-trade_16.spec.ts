/* eslint-disable @typescript-eslint/no-explicit-any */

import { database } from '@buildcore/database';
import {
  COL,
  MIN_IOTA_AMOUNT,
  TokenTradeOrder,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
  WEN_FUNC,
} from '@buildcore/interfaces';
import { MnemonicService } from '../../src/services/wallet/mnemonic';
import { wait } from '../../test/controls/common';
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

  it('Should create sell with higher storage deposit', async () => {
    mockWalletReturnValue(helper.seller!, {
      symbol: helper.token!.symbol,
      count: 1,
      price: 5 * MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder: Transaction = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await helper.walletService!.send(
      helper.sellerAddress!,
      sellOrder.payload.targetAddress!,
      12 * MIN_IOTA_AMOUNT,
      {
        nativeTokens: [{ amount: BigInt(1), id: helper.token!.mintingData?.tokenId! }],
      },
    );
    await wait(async () => {
      const snap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('orderTransactionId', '==', sellOrder.uid)
        .get();
      return snap.length === 1;
    });
    await MnemonicService.store(
      helper.sellerAddress!.bech32,
      helper.sellerAddress!.mnemonic,
      helper.network!,
    );

    const sell = <TokenTradeOrder>(
      (
        await database()
          .collection(COL.TOKEN_MARKET)
          .where('orderTransactionId', '==', sellOrder.uid)
          .get()
      )[0]
    );

    mockWalletReturnValue(helper.seller!, { uid: sell.uid });
    await testEnv.wrap<TokenTradeOrder>(WEN_FUNC.cancelTradeOrder);

    const sellerCreditSnap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(sellerCreditSnap.length).toBe(1);
    const sellerCredit = sellerCreditSnap.map((d) => d as Transaction)[0];
    expect(sellerCredit.payload.amount).toBe(12 * MIN_IOTA_AMOUNT);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });

  it('Should fulfill sell and credit higher storage deposit', async () => {
    await helper.createBuyOrder(1, 5 * MIN_IOTA_AMOUNT);

    mockWalletReturnValue(helper.seller!, {
      symbol: helper.token!.symbol,
      count: 1,
      price: 5 * MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder: Transaction = await testEnv.wrap<Transaction>(WEN_FUNC.tradeToken);
    await helper.walletService!.send(
      helper.sellerAddress!,
      sellOrder.payload.targetAddress!,
      12 * MIN_IOTA_AMOUNT,
      {
        nativeTokens: [{ amount: BigInt(1), id: helper.token!.mintingData?.tokenId! }],
      },
    );
    await wait(async () => {
      const snap = await database()
        .collection(COL.TOKEN_MARKET)
        .where('orderTransactionId', '==', sellOrder.uid)
        .get();
      return snap.length === 1;
    });
    await MnemonicService.store(
      helper.sellerAddress!.bech32,
      helper.sellerAddress!.mnemonic,
      helper.network!,
    );

    await wait(async () => {
      const snap = await database()
        .collection(COL.TOKEN_PURCHASE)
        .where('token', '==', helper.token!.uid)
        .get();
      return snap.length === 1;
    });

    const sellerCreditSnap = await database()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.seller)
      .where('type', '==', TransactionType.CREDIT)
      .get();
    expect(sellerCreditSnap.length).toBe(1);
    const sellerCredit = sellerCreditSnap.map((d) => d as Transaction)[0];
    expect(sellerCredit.payload.amount).toBe(12 * MIN_IOTA_AMOUNT);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
  });
});
