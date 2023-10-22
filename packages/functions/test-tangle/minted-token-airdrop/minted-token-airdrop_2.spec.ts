/* eslint-disable @typescript-eslint/no-explicit-any */

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
} from '@build-5/interfaces';

import { build5Db } from '@build-5/database';
import dayjs from 'dayjs';
import {
  airdropMintedToken,
  claimMintedTokenOrder,
  mintTokenOrder,
} from '../../src/runtime/firebase/token/minting';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp, serverTime } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
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
  });

  it('Mint token, airdrop then claim all', async () => {
    await build5Db().doc(`${COL.TOKEN}/${helper.token!.uid}`).update({
      mintingData: {},
      status: TokenStatus.AVAILABLE,
      totalSupply: Number.MAX_SAFE_INTEGER,
    });
    await build5Db()
      .doc(`${COL.TOKEN}/${helper.token!.uid}/${SUB_COL.DISTRIBUTION}/${helper.member}`)
      .set({ tokenOwned: 1 });

    const airdrop: TokenDrop = {
      createdOn: serverTime(),
      createdBy: helper.guardian!,
      uid: getRandomEthAddress(),
      member: helper.member!,
      token: helper.token!.uid,
      vestingAt: dateToTimestamp(dayjs().add(1, 'd')),
      count: 1,
      status: TokenDropStatus.UNCLAIMED,
    };
    await build5Db().doc(`${COL.AIRDROP}/${airdrop.uid}`).create(airdrop);

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

    const guardian = <Member>await build5Db().doc(`${COL.MEMBER}/${helper.guardian}`).get();
    await requestFundsFromFaucet(
      helper.network,
      getAddress(guardian, helper.network),
      MIN_IOTA_AMOUNT,
    );
    await wait(async () => {
      const tokenDocRef = await build5Db().doc(`${COL.TOKEN}/${helper.token!.uid}`).get<Token>();
      return tokenDocRef?.status === TokenStatus.MINTED;
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
    const token = <Token>await build5Db().doc(`${COL.TOKEN}/${helper.token!.uid}`).get();
    await helper.walletService!.send(guardianAddress, order.payload.targetAddress, 0, {
      nativeTokens: [{ id: token.mintingData?.tokenId!, amount: BigInt(2) }],
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

    const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
    await wait(async () => {
      order = <Transaction>await orderDocRef.get();
      return order.payload.unclaimedAirdrops === 0;
    });

    const distributionDocRef = build5Db().doc(
      `${COL.TOKEN}/${helper.token!.uid}/${SUB_COL.DISTRIBUTION}/${helper.member}`,
    );
    const distribution = <TokenDistribution | undefined>await distributionDocRef.get();
    expect(distribution?.tokenOwned).toBe(4);
    expect(distribution?.tokenClaimed).toBe(3);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);

    const billPayments = (
      await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('member', '==', helper.member)
        .get()
    ).map((d) => d as Transaction);
    expect(billPayments.length).toBe(4);

    const credit = (
      await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', order.member)
        .get()
    ).map((d) => <Transaction>d);
    expect(credit.length).toBe(2);

    const member = <Member>await build5Db().doc(`${COL.MEMBER}/${helper.member}`).get();
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
