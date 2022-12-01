/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenStatus,
  Transaction,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import admin from '../../src/admin.config';
import { airdropMintedToken } from '../../src/controls/token-minting/airdrop-minted-token';
import { claimMintedTokenOrder } from '../../src/controls/token-minting/claim-minted-token.control';
import { mintTokenOrder } from '../../src/controls/token-minting/token-mint.control';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import * as wallet from '../../src/utils/wallet.utils';
import { mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Minted token airdrop', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.berforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();

    await admin.firestore().doc(`${COL.TOKEN}/${helper.token!.uid}`).update({
      mintingData: {},
      status: TokenStatus.AVAILABLE,
      totalSupply: Number.MAX_SAFE_INTEGER,
    });
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token!.uid}/${SUB_COL.DISTRIBUTION}/${helper.member}`)
      .set({
        tokenOwned: 1,
        tokenDrops: [
          {
            count: 1,
            uid: wallet.getRandomEthAddress(),
            vestingAt: dateToTimestamp(dayjs().add(1, 'd').toDate()),
          },
        ],
      });
  });

  it('Mint token, airdrop then claim all', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      token: helper.token!.uid,
      network: helper.network,
    });
    const mintingOrder = await testEnv.wrap(mintTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      mintingOrder.payload.targetAddress,
      mintingOrder.payload.amount,
    );

    const guardian = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${helper.guardian}`).get()).data()
    );
    await requestFundsFromFaucet(
      helper.network,
      getAddress(guardian, helper.network),
      MIN_IOTA_AMOUNT,
    );
    await wait(async () => {
      const tokenDocRef = await admin.firestore().doc(`${COL.TOKEN}/${helper.token!.uid}`).get();
      return tokenDocRef.data()?.status === TokenStatus.MINTED;
    });

    const drops = [
      { count: 1, recipient: helper.member!, vestingAt: dayjs().subtract(1, 'm').toDate() },
      { count: 1, recipient: helper.member!, vestingAt: dayjs().add(2, 'h').toDate() },
    ];
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      token: helper.token!.uid,
      drops,
    });
    let order = await testEnv.wrap(airdropMintedToken)({});
    const guardianAddress = await helper.walletService!.getAddressDetails(
      getAddress(guardian, helper.network),
    );
    const token = <Token>(
      (await admin.firestore().doc(`${COL.TOKEN}/${helper.token!.uid}`).get()).data()
    );
    await helper.walletService!.send(guardianAddress, order.payload.targetAddress, 0, {
      nativeTokens: [{ id: token.mintingData?.tokenId!, amount: (2).toString(16) }],
    });
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token!.uid}/${SUB_COL.DISTRIBUTION}/${helper.member}`);
    await wait(async () => {
      const docRef = await distributionDocRef.get();
      return docRef.data()?.tokenDrops.length === 3;
    });

    mockWalletReturnValue(helper.walletSpy, helper.member!, {
      token: helper.token!.uid,
    });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    await wait(async () => {
      order = <Transaction>(
        (await admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`).get()).data()
      );
      return isEmpty(order.payload.drops);
    });
    const distribution = <TokenDistribution | undefined>(await distributionDocRef.get()).data();
    expect(distribution?.tokenDrops?.length).toBe(0);
    expect(distribution?.tokenDropsHistory?.length).toBe(3);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);

    const billPayments = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('member', '==', helper.member)
        .get()
    ).docs.map((d) => d.data() as Transaction);
    expect(billPayments.length).toBe(4);

    const credit = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', order.member)
        .get()
    ).docs.map((d) => <Transaction>d.data());
    expect(credit.length).toBe(2);

    const member = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${helper.member}`).get()).data()
    );
    const memberAddress = await helper.walletService!.getAddressDetails(
      getAddress(member, helper.network),
    );

    for (const hasTimelock of [false, true]) {
      const outputs = await helper.walletService!.getOutputs(
        memberAddress.bech32,
        [],
        false,
        hasTimelock,
      );
      expect(
        Object.values(outputs).reduce((acc, act) => acc + Number(act.nativeTokens![0].amount), 0),
      ).toBe(2);
    }
  });
});
