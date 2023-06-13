/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  MIN_IOTA_AMOUNT,
  Token,
  TokenStatus,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import { cancelPublicSale, setTokenAvailableForSale } from '../../src/runtime/firebase/token/base';
import { mintTokenOrder } from '../../src/runtime/firebase/token/minting';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should credit, token in public sale', async () => {
    await helper.setup();

    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const order = await testEnv.wrap(mintTokenOrder)({});

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
    await testEnv.wrap(setTokenAvailableForSale)({});

    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.guardian.uid);
    await wait(async () => {
      const credit = (await creditQuery.get()).map((d) => <Transaction>d)[0];
      return credit?.payload?.walletReference?.confirmed;
    });
    const credit = (await creditQuery.get()).map((d) => <Transaction>d)[0];
    expect(credit?.payload?.amount).toBe(order.payload.amount);
  });

  it('Should credit, token in public sale, cancel public sale then mint', async () => {
    await helper.setup();

    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const order = await testEnv.wrap(mintTokenOrder)({});

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
    await testEnv.wrap(setTokenAvailableForSale)({});

    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    const creditQuery = build5Db()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.guardian.uid);
    await wait(async () => {
      const credit = (await creditQuery.get()).map((d) => <Transaction>d)[0];
      return credit?.payload?.walletReference?.confirmed;
    });
    const credit = (await creditQuery.get()).map((d) => <Transaction>d)[0];
    expect(credit?.payload?.amount).toBe(order.payload.amount);

    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, { token: helper.token.uid });
    await testEnv.wrap(cancelPublicSale)({});
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    await wait(async () => {
      const tokenData = <Token>await build5Db().doc(`${COL.TOKEN}/${helper.token.uid}`).get();
      return tokenData.status === TokenStatus.MINTED;
    });
  });
});
