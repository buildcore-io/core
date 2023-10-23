/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import {
  COL,
  IgnoreWalletReason,
  MIN_IOTA_AMOUNT,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import { creditUnrefundable } from '../../src/runtime/firebase/credit/index';
import { tradeToken } from '../../src/runtime/firebase/token/trading';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.berforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should credit sell order, storage deposit unlock condition', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      symbol: helper.token!.symbol,
      count: 10,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder: Transaction = await testEnv.wrap(tradeToken)({});
    await helper.walletService!.send(helper.sellerAddress!, sellOrder.payload.targetAddress!, 0, {
      nativeTokens: [{ amount: BigInt(10), id: helper.token!.mintingData?.tokenId! }],
      storageDepositReturnAddress: helper.sellerAddress?.bech32,
    });
    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.seller);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return (
        snap.length === 1 &&
        snap[0]!.ignoreWalletReason ===
          IgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION &&
        snap[0]!.payload.targetAddress === helper.sellerAddress!.bech32
      );
    });
    const snap = await query.get<Transaction>();
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      transaction: snap[0].uid,
    });
    const order = await testEnv.wrap(creditUnrefundable)({});
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    await wait(async () => {
      const snap = await query.get<Transaction>();
      return snap.length === 1 && snap[0]!.payload?.walletReference?.confirmed;
    });
    const creditStorageTran = <Transaction>(
      (
        await build5Db()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED)
          .where('member', '==', helper.seller)
          .get()
      )[0]
    );
    const creditSnap = await query.get<Transaction>();
    expect(creditSnap[0]!.payload?.walletReference?.chainReference).toBe(
      creditStorageTran.payload.walletReference?.chainReference,
    );
    expect(creditSnap[0]!.payload?.walletReference?.chainReferences).toEqual(
      creditStorageTran.payload.walletReference?.chainReferences,
    );
    expect(creditSnap[0]!.payload?.walletReference?.inProgress).toBe(false);
    expect(creditSnap[0]!.payload?.walletReference?.processedOn).toBeDefined();

    const outputs = await helper.walletService!.getOutputs(
      helper.sellerAddress?.bech32!,
      [],
      false,
    );
    const total = Object.values(outputs).reduce((acc, act) => acc + Number(act.amount), 0);
    expect(total).toBe(20053800);
    const totalNativeTokens = Object.values(outputs).reduce(
      (acc, act) => acc + Number((act.nativeTokens || [])[0]?.amount || 0),
      0,
    );
    expect(totalNativeTokens).toBe(20);
  });

  it('Shoult credit second unlock credit', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      symbol: helper.token!.symbol,
      count: 10,
      price: MIN_IOTA_AMOUNT,
      type: TokenTradeOrderType.SELL,
    });
    const sellOrder: Transaction = await testEnv.wrap(tradeToken)({});
    await helper.walletService!.send(helper.sellerAddress!, sellOrder.payload.targetAddress!, 0, {
      nativeTokens: [{ amount: BigInt(10), id: helper.token!.mintingData?.tokenId! }],
      storageDepositReturnAddress: helper.sellerAddress?.bech32,
    });
    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.seller);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return (
        snap.length === 1 &&
        snap[0]!.ignoreWalletReason ===
          IgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION &&
        snap[0]!.payload.targetAddress === helper.sellerAddress!.bech32
      );
    });
    const snap = await query.get<Transaction>();
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      transaction: snap[0].uid,
    });
    const order = await testEnv.wrap(creditUnrefundable)({});
    const order2 = await testEnv.wrap(creditUnrefundable)({});

    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);
    await requestFundsFromFaucet(
      helper.network,
      order2.payload.targetAddress,
      order2.payload.amount,
    );

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', helper.seller)
        .get();
      return snap.length == 2;
    });

    const transaction = <Transaction>(
      await build5Db().doc(`${COL.TRANSACTION}/${snap[0].uid}`).get()
    );
    expect(transaction.payload.unlockedBy).toBeDefined();
  });
});
