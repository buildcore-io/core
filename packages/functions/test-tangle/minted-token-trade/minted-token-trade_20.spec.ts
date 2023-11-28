/* eslint-disable @typescript-eslint/no-explicit-any */

import { build5Db } from '@build-5/database';
import {
  COL,
  IgnoreWalletReason,
  MIN_IOTA_AMOUNT,
  TRANSACTION_AUTO_EXPIRY_MS,
  TokenTradeOrderType,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { creditUnrefundable } from '../../src/runtime/firebase/credit/index';
import { tradeToken } from '../../src/runtime/firebase/token/trading';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.berforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should not create sell order, storage deposit unlock condition, also not claimable', async () => {
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
      expiration: {
        expiresAt: dateToTimestamp(dayjs().add(2, 'minutes')),
        returnAddressBech32: helper.sellerAddress?.bech32!,
      },
    });
    const query = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.seller);
    await wait(async () => {
      const snap = await query.get<Transaction>();
      return (
        snap.length === 1 &&
        snap[0].ignoreWalletReason ===
          IgnoreWalletReason.UNREFUNDABLE_DUE_STORAGE_DEPOSIT_CONDITION &&
        snap[0].payload.targetAddress === helper.sellerAddress!.bech32
      );
    });

    const snap = await query.get<Transaction>();
    mockWalletReturnValue(helper.walletSpy, helper.seller!, { transaction: snap[0].uid });
    const order = await testEnv.wrap(creditUnrefundable)({});

    const expiresOn = order.payload.expiresOn!;
    const isEarlier = dayjs(expiresOn.toDate()).isBefore(dayjs().add(TRANSACTION_AUTO_EXPIRY_MS));
    expect(isEarlier).toBe(true);
  });
});
