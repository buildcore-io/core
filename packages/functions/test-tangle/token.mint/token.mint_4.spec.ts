/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  MIN_IOTA_AMOUNT,
  Token,
  TokenStatus,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { mintTokenOrder } from '../../src/controls/token-minting/token-mint.control';
import { cancelPublicSale, setTokenAvailableForSale } from '../../src/controls/token.control';
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
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    const updateData = { token: helper.token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, updateData);
    await testEnv.wrap(setTokenAvailableForSale)({});

    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    const creditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.guardian.uid);
    await wait(async () => {
      const credit = (await creditQuery.get()).docs.map((d) => <Transaction>d.data())[0];
      return credit?.payload?.walletReference?.confirmed;
    });
    const credit = (await creditQuery.get()).docs.map((d) => <Transaction>d.data())[0];
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
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token.uid}`)
      .update({ allocations: [{ title: 'public', percentage: 100, isPublicSale: true }] });
    const updateData = { token: helper.token.uid, ...publicTime, pricePerToken: MIN_IOTA_AMOUNT };
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, updateData);
    await testEnv.wrap(setTokenAvailableForSale)({});

    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    const creditQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('type', '==', TransactionType.CREDIT)
      .where('member', '==', helper.guardian.uid);
    await wait(async () => {
      const credit = (await creditQuery.get()).docs.map((d) => <Transaction>d.data())[0];
      return credit?.payload?.walletReference?.confirmed;
    });
    const credit = (await creditQuery.get()).docs.map((d) => <Transaction>d.data())[0];
    expect(credit?.payload?.amount).toBe(order.payload.amount);

    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, { token: helper.token.uid });
    await testEnv.wrap(cancelPublicSale)({});
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    await wait(async () => {
      const tokenData = <Token>(
        (await admin.firestore().doc(`${COL.TOKEN}/${helper.token.uid}`).get()).data()
      );
      return tokenData.status === TokenStatus.MINTED;
    });
  });
});