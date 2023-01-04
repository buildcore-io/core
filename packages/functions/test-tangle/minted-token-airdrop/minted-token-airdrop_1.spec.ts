/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  StakeType,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenDropStatus,
  TokenStats,
  Transaction,
  TransactionType,
  WenError,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import admin from '../../src/admin.config';
import { airdropMintedToken } from '../../src/controls/token-minting/airdrop-minted-token';
import { claimMintedTokenOrder } from '../../src/controls/token-minting/claim-minted-token.control';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
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

  it.each([false, true])('Should drop and claim minted token', async (hasExpiration: boolean) => {
    const expiresAt = hasExpiration ? dateToTimestamp(dayjs().add(2, 'h').toDate()) : undefined;
    const stakeType = hasExpiration ? StakeType.STATIC : StakeType.DYNAMIC;
    const drops = [
      {
        count: 1,
        recipient: helper.member!,
        vestingAt: dayjs().subtract(1, 'm').toDate(),
      },
      { count: 1, recipient: helper.member!, vestingAt: dayjs().add(2, 'M').toDate(), stakeType },
    ];
    const total = drops.reduce((acc, act) => acc + act.count, 0);
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      token: helper.token!.uid,
      drops,
    });
    let order = await testEnv.wrap(airdropMintedToken)({});
    expect(order.payload.unclaimedAirdrops).toBe(2);

    mockWalletReturnValue(helper.walletSpy, helper.member!, { token: helper.token!.uid });
    await expectThrow(testEnv.wrap(claimMintedTokenOrder)({}), WenError.no_tokens_to_claim.key);

    const guardian = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${helper.guardian}`).get()).data()
    );
    const guardianAddress = await helper.walletService!.getAddressDetails(
      getAddress(guardian, helper.network),
    );
    await requestFundsFromFaucet(
      helper.network,
      guardianAddress.bech32,
      5 * MIN_IOTA_AMOUNT,
      expiresAt,
    );
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      guardianAddress,
      helper.token!.mintingData?.tokenId!,
      VAULT_MNEMONIC,
      total,
      expiresAt,
    );

    await helper.walletService!.send(guardianAddress, order.payload.targetAddress, 0, {
      expiration: expiresAt
        ? { expiresAt, returnAddressBech32: guardianAddress.bech32 }
        : undefined,
      nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: total.toString(16) }],
    });

    await wait(async () => {
      const airdrops = await helper.getAirdropsForMember(helper.member!);
      return airdrops.length === 2;
    });

    mockWalletReturnValue(helper.walletSpy, helper.member!, {
      token: helper.token!.uid,
    });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
      expiresAt,
    );

    await wait(async () => {
      const orderDocRef = admin.firestore().doc(`${COL.TRANSACTION}/${order.uid}`);
      order = <Transaction>(await orderDocRef.get()).data();
      return order.payload.unclaimedAirdrops === 0;
    });

    const airdrops = await helper.getAirdropsForMember(helper.member!, TokenDropStatus.CLAIMED);
    expect(airdrops.length).toBe(2);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);

    const billPayments = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('member', '==', helper.member)
        .get()
    ).docs.map((d) => d.data() as Transaction);
    expect(billPayments.length).toBe(2);
    for (let i = 0; i < drops.length; ++i) {
      expect(
        billPayments.find((bp) => {
          if (dayjs(drops[i].vestingAt).isBefore(dayjs())) {
            return bp.payload.vestingAt === null;
          }
          return (
            bp.payload.vestingAt &&
            dayjs(bp.payload.vestingAt.toDate()).isSame(dayjs(drops[i].vestingAt))
          );
        }),
      ).toBeDefined();
    }

    const credit = (
      await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', '==', order.member)
        .get()
    ).docs.map((d) => <Transaction>d.data());
    expect(credit.length).toBe(1);

    const balance = await helper.walletService?.getBalance(guardianAddress.bech32);
    expect(balance).toBe(5 * MIN_IOTA_AMOUNT);

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
      ).toBe(1);
    }

    await awaitTransactionConfirmationsForToken(helper.token?.uid!);

    const tokenUid = helper.token?.uid;

    helper.token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${tokenUid}`).get()).data();
    expect(helper.token.mintingData?.tokensInVault).toBe(0);
    const tokenStats = <TokenStats>(
      (
        await admin.firestore().doc(`${COL.TOKEN}/${tokenUid}/${SUB_COL.STATS}/${tokenUid}`).get()
      ).data()
    );
    expect(tokenStats.stakes![StakeType.DYNAMIC]?.amount).toBe(1);
    expect(tokenStats.stakes![StakeType.DYNAMIC]?.totalAmount).toBe(1);
    expect(tokenStats.stakes![StakeType.DYNAMIC]?.value).toBe(1);
    expect(tokenStats.stakes![StakeType.DYNAMIC]?.totalValue).toBe(1);

    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token!.uid}/${SUB_COL.DISTRIBUTION}/${helper.member}`);
    const distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.stakes![StakeType.DYNAMIC]?.amount).toBe(1);
    expect(distribution.stakes![StakeType.DYNAMIC]?.totalAmount).toBe(1);
    expect(distribution.stakes![StakeType.DYNAMIC]?.value).toBe(1);
    expect(distribution.stakes![StakeType.DYNAMIC]?.totalValue).toBe(1);
  });

  it('Multiplier should be max 2', async () => {
    const stakeType = StakeType.DYNAMIC;
    const drops = [
      {
        count: 1,
        recipient: helper.member!,
        vestingAt: dayjs().add(6000, 'y').toDate(),
        stakeType,
      },
    ];
    mockWalletReturnValue(helper.walletSpy, helper.guardian!, {
      token: helper.token!.uid,
      drops,
    });
    let order = await testEnv.wrap(airdropMintedToken)({});
    expect(
      order.payload.drops.map((d: any) => ({ ...d, vestingAt: d.vestingAt.toDate() })),
    ).toEqual(drops);

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
      1,
    );

    await helper.walletService!.send(guardianAddress, order.payload.targetAddress, 0, {
      nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: '0x1' }],
    });

    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token!.uid}/${SUB_COL.DISTRIBUTION}/${helper.member}`);
    await wait(async () => {
      const distribution = <TokenDistribution | undefined>(await distributionDocRef.get()).data();
      return distribution?.tokenDrops?.length === 1;
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

    await awaitTransactionConfirmationsForToken(helper.token!.uid);
    let distribution = <TokenDistribution | undefined>(await distributionDocRef.get()).data();
    expect(distribution?.tokenDrops?.length).toBe(0);
    expect(distribution?.tokenDropsHistory?.length).toBe(1);
    expect(distribution?.stakes![stakeType].value).toBe(2);
  });
});
