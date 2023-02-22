/* eslint-disable @typescript-eslint/no-explicit-any */

import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  MIN_IOTA_AMOUNT,
  TokenTradeOrderType,
  Transaction,
  TransactionIgnoreWalletReason,
  TransactionType,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import admin from '../../src/admin.config';
import { creditUnrefundable } from '../../src/runtime/firebase/credit/index';
import { tradeToken } from '../../src/controls/token-trading/token-trade.controller';
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
    await helper.walletService!.send(helper.sellerAddress!, sellOrder.payload.targetAddress, 0, {
      nativeTokens: [
        { amount: HexHelper.fromBigInt256(bigInt(10)), id: helper.token!.mintingData?.tokenId! },
      ],
      storageDepositReturnAddress: helper.sellerAddress?.bech32,
    });
    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.seller);
    await wait(async () => {
      const snap = await query.get();
      return (
        snap.size === 1 &&
        snap.docs[0].data()!.ignoreWalletReason ===
          TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION &&
        snap.docs[0].data()!.payload.targetAddress === helper.sellerAddress!.bech32
      );
    });
    const snap = await query.get();
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      transaction: snap.docs[0].id,
    });
    const order = await testEnv.wrap(creditUnrefundable)({});
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    await wait(async () => {
      const snap = await query.get();
      return snap.size === 1 && snap.docs[0].data()!.payload?.walletReference?.confirmed;
    });
    const creditStorageTran = <Transaction>(
      (
        await admin
          .firestore()
          .collection(COL.TRANSACTION)
          .where('type', '==', TransactionType.CREDIT_STORAGE_DEPOSIT_LOCKED)
          .where('member', '==', helper.seller)
          .get()
      ).docs[0].data()
    );
    const creditSnap = await query.get();
    expect(creditSnap.docs[0].data()!.payload?.walletReference?.chainReference).toBe(
      creditStorageTran.payload.walletReference?.chainReference,
    );
    expect(creditSnap.docs[0].data()!.payload?.walletReference?.chainReferences).toEqual(
      creditStorageTran.payload.walletReference?.chainReferences,
    );
    expect(creditSnap.docs[0].data()!.payload?.walletReference?.inProgress).toBe(false);
    expect(creditSnap.docs[0].data()!.payload?.walletReference?.processedOn).toBeDefined();

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
    await helper.walletService!.send(helper.sellerAddress!, sellOrder.payload.targetAddress, 0, {
      nativeTokens: [
        { amount: HexHelper.fromBigInt256(bigInt(10)), id: helper.token!.mintingData?.tokenId! },
      ],
      storageDepositReturnAddress: helper.sellerAddress?.bech32,
    });
    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.seller);
    await wait(async () => {
      const snap = await query.get();
      return (
        snap.size === 1 &&
        snap.docs[0].data()!.ignoreWalletReason ===
          TransactionIgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION &&
        snap.docs[0].data()!.payload.targetAddress === helper.sellerAddress!.bech32
      );
    });
    const snap = await query.get();
    mockWalletReturnValue(helper.walletSpy, helper.seller!, {
      transaction: snap.docs[0].id,
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
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', helper.seller)
        .get();
      return snap.size == 2;
    });

    const transaction = <Transaction>(
      (await admin.firestore().doc(`${COL.TRANSACTION}/${snap.docs[0].id}`).get()).data()
    );
    expect(transaction.payload.unlockedBy).toBeDefined();
  });
});
