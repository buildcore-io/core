/* eslint-disable @typescript-eslint/no-explicit-any */

import { HexHelper } from '@iota/util.js-next';
import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  TokenStatus,
  Transaction,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import bigInt from 'big-integer';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import {
  airdropMintedToken,
  claimMintedTokenOrder,
  mintTokenOrder,
} from '../../src/runtime/firebase/token/minting';
import { getAddress } from '../../src/utils/address.utils';
import { cOn, dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { expectThrow, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { Helper, VAULT_MNEMONIC } from './Helper';

describe('Minted token airdrop', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.berforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  it('Mint token, airdrop then claim all', async () => {
    await admin.firestore().doc(`${COL.TOKEN}/${helper.token!.uid}`).update({
      mintingData: {},
      status: TokenStatus.AVAILABLE,
      totalSupply: Number.MAX_SAFE_INTEGER,
    });
    await admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token!.uid}/${SUB_COL.DISTRIBUTION}/${helper.member}`)
      .set({ tokenOwned: 1 });

    const airdrop: TokenDrop = {
      createdBy: helper.guardian!,
      uid: getRandomEthAddress(),
      member: helper.member!,
      token: helper.token!.uid,
      vestingAt: dateToTimestamp(dayjs().add(1, 'd')),
      count: 1,
      status: TokenDropStatus.UNCLAIMED,
    };
    await admin.firestore().doc(`${COL.AIRDROP}/${airdrop.uid}`).create(cOn(airdrop));

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

    await wait(async () => {
      const airdrops = await helper.getAirdropsForMember(helper.member!);
      return airdrops.length === 3;
    });

    mockWalletReturnValue(helper.walletSpy, helper.member!, { symbol: helper.token!.symbol });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
    await wait(async () => {
      order = <Transaction>(await orderDocRef.get()).data();
      return order.payload.unclaimedAirdrops === 0;
    });

    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token!.uid}/${SUB_COL.DISTRIBUTION}/${helper.member}`);
    const distribution = <TokenDistribution | undefined>(await distributionDocRef.get()).data();
    expect(distribution?.tokenOwned).toBe(4);
    expect(distribution?.tokenClaimed).toBe(3);

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

  it('Should airdrop and claim 600', async () => {
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      token: helper.token!.uid,
      drops: Array.from(Array(600)).map(() => ({
        count: 1,
        recipient: helper.member!,
        vestingAt: dayjs().add(1, 'y').toDate(),
      })),
    });
    let order = await testEnv.wrap(airdropMintedToken)({});
    expect(order.payload.unclaimedAirdrops).toBe(600);

    mockWalletReturnValue(helper.walletSpy, helper.member!, { symbol: helper.token!.symbol });
    await expectThrow(testEnv.wrap(claimMintedTokenOrder)({}), WenError.no_tokens_to_claim.key);

    const guardian = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${helper.guardian}`).get()).data()
    );
    const guardianAddress = await helper.walletService!.getAddressDetails(
      getAddress(guardian, helper.network),
    );
    await requestFundsFromFaucet(helper.network, guardianAddress.bech32, 5 * MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      guardianAddress,
      helper.token!.mintingData?.tokenId!,
      VAULT_MNEMONIC,
      600,
    );

    await helper.walletService!.send(guardianAddress, order.payload.targetAddress, 0, {
      nativeTokens: [
        { id: helper.token?.mintingData?.tokenId!, amount: HexHelper.fromBigInt256(bigInt(600)) },
      ],
    });

    await wait(async () => {
      const airdrops = await helper.getAirdropsForMember(helper.member!);
      return airdrops.length === 600;
    });

    mockWalletReturnValue(helper.walletSpy, helper.member!, {
      symbol: helper.token!.symbol,
    });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    await wait(async () => {
      const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
      order = <Transaction>(await orderDocRef.get()).data();
      return order.payload.unclaimedAirdrops === 0;
    });

    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token?.uid}/${SUB_COL.DISTRIBUTION}/${helper.member!}`);
    const distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.tokenOwned).toBe(600);
    expect(distribution.tokenClaimed).toBe(600);

    const stakesSnap = await admin
      .firestore()
      .collection(COL.STAKE)
      .where('member', '==', helper.member)
      .get();
    expect(stakesSnap.size).toBe(600);
  });
});
