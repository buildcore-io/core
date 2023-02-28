/* eslint-disable @typescript-eslint/no-explicit-any */

import { addressBalance } from '@iota/iota.js-next';
import { COL, Member, Token, TokenStatus, TransactionType, WenError } from '@soonaverse/interfaces';
import admin from '../../src/admin.config';
import { mintTokenOrder } from '../../src/controls/token-minting/token-mint.control';
import { getAddress } from '../../src/utils/address.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { expectThrow, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Token minting', () => {
  const helper = new Helper();

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Should mint token and melt some', async () => {
    await helper.setup();
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const order = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${helper.token.uid}`);
    await wait(async () => {
      helper.token = <Token>(await tokenDocRef.get()).data();
      return helper.token.status === TokenStatus.MINTED;
    });

    const guardianData = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${helper.guardian.uid}`).get()).data()
    );
    const guardianAddress = getAddress(guardianData, helper.network);
    await wait(async () => {
      const balance = await addressBalance(helper.walletService.client, guardianAddress);
      return Number(Object.values(balance.nativeTokens)[0]) === 500;
    });

    await helper.meltMintedToken(helper.walletService, helper.token, 250, guardianAddress);

    await wait(async () => {
      helper.token = <Token>(await tokenDocRef.get()).data();
      return (
        helper.token.mintingData?.meltedTokens === 250 &&
        helper.token.mintingData?.circulatingSupply === 1250
      );
    });
  });

  it('Should create order, not approved but public', async () => {
    await helper.setup();
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token.uid}`)
      .update({ approved: false, public: true });
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const order = await testEnv.wrap(mintTokenOrder)({});
    expect(order).toBeDefined();
  });

  it('Should throw, member has no valid address', async () => {
    await helper.setup();
    await admin
      .firestore()
      .doc(`${COL.MEMBER}/${helper.guardian.uid}`)
      .update({ validatedAddress: {} });
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    await expectThrow(
      testEnv.wrap(mintTokenOrder)({}),
      WenError.member_must_have_validated_address.key,
    );
  });

  it('Should throw, not guardian', async () => {
    await helper.setup();
    mockWalletReturnValue(helper.walletSpy, wallet.getRandomEthAddress(), {
      token: helper.token.uid,
      network: helper.network,
    });
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.you_are_not_guardian_of_space.key);
  });

  it('Should throw, already minted', async () => {
    await helper.setup();
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token.uid}`)
      .update({ status: TokenStatus.MINTED });
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.token_in_invalid_status.key);
  });

  it('Should throw, not approved and not public', async () => {
    await helper.setup();
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token.uid}`)
      .update({ approved: false, public: false });
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    await expectThrow(testEnv.wrap(mintTokenOrder)({}), WenError.token_not_approved.key);
  });

  it('Should credit, already minted', async () => {
    await helper.setup();
    mockWalletReturnValue(helper.walletSpy, helper.guardian.uid, {
      token: helper.token.uid,
      network: helper.network,
    });
    const order = await testEnv.wrap(mintTokenOrder)({});
    const order2 = await testEnv.wrap(mintTokenOrder)({});

    await requestFundsFromFaucet(helper.network, order.payload.targetAddress, order.payload.amount);
    await requestFundsFromFaucet(
      helper.network,
      order2.payload.targetAddress,
      order2.payload.amount,
    );

    const tokenDocRef = admin.firestore().doc(`${COL.TOKEN}/${helper.token.uid}`);
    await wait(async () => {
      const snap = await tokenDocRef.get();
      return snap.data()?.status === TokenStatus.MINTED;
    });
    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', helper.guardian.uid)
        .get();
      return snap.size > 0;
    });
    await awaitTransactionConfirmationsForToken(helper.token.uid);
  });
});
