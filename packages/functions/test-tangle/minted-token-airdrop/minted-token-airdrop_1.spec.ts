/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  COL,
  MIN_IOTA_AMOUNT,
  Member,
  SUB_COL,
  StakeType,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  TokenStats,
  Transaction,
  TransactionPayloadType,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { head } from 'lodash';
import { build5Db } from '../../src/firebase/firestore/build5Db';
import {
  airdropMintedToken,
  claimMintedTokenOrder,
} from '../../src/runtime/firebase/token/minting';
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

    mockWalletReturnValue(helper.walletSpy, helper.member!, { symbol: helper.token!.symbol });
    await expectThrow(testEnv.wrap(claimMintedTokenOrder)({}), WenError.no_tokens_to_claim.key);

    const guardian = <Member>await build5Db().doc(`${COL.MEMBER}/${helper.guardian}`).get();
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
      nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: BigInt(total) }],
    });

    await wait(async () => {
      const airdrops = await helper.getAirdropsForMember(helper.member!);
      return airdrops.length === 2;
    });

    const distributionDocRef = build5Db().doc(
      `${COL.TOKEN}/${helper.token!.uid}/${SUB_COL.DISTRIBUTION}/${helper.member}`,
    );
    let distribution = <TokenDistribution>await distributionDocRef.get();
    expect(distribution.totalUnclaimedAirdrop).toBe(2);

    mockWalletReturnValue(helper.walletSpy, helper.member!, {
      symbol: helper.token!.symbol,
    });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    const claimOrder2 = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
      expiresAt,
    );
    await requestFundsFromFaucet(
      helper.network,
      claimOrder2.payload.targetAddress,
      claimOrder2.payload.amount,
      expiresAt,
    );

    await wait(async () => {
      const orderDocRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
      order = <Transaction>await orderDocRef.get();
      return order.payload.unclaimedAirdrops === 0;
    });

    const airdrops = await helper.getAirdropsForMember(helper.member!, TokenDropStatus.CLAIMED);
    expect(airdrops.length).toBe(2);

    await awaitTransactionConfirmationsForToken(helper.token!.uid);

    const billPayments = (
      await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .where('member', '==', helper.member)
        .get()
    ).map((d) => d as Transaction);
    expect(billPayments.length).toBe(2);
    billPayments.forEach((billPayment) => {
      expect(billPayment.payload.token).toBe(helper.token!.uid);
      expect(billPayment.payload.tokenSymbol).toBe(helper.token!.symbol);
      expect(billPayment.payload.type).toBe(TransactionPayloadType.MINTED_AIRDROP_CLAIM);
    });
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

    await wait(async () => {
      const snap = await build5Db()
        .collection(COL.TRANSACTION)
        .where('type', '==', TransactionType.CREDIT)
        .where('member', 'in', [helper.guardian, helper.member])
        .get();
      return snap.length === 2;
    });

    const { amount } = await helper.walletService!.getBalance(guardianAddress.bech32);
    expect(amount).toBe(5 * MIN_IOTA_AMOUNT);

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
      const sum = Object.values(outputs).reduce(
        (acc, act) => acc + Number(head(act?.nativeTokens)?.amount || 0),
        0,
      );
      expect(sum).toBe(1);
    }

    await awaitTransactionConfirmationsForToken(helper.token?.uid!);

    const tokenUid = helper.token?.uid;

    helper.token = <Token>await build5Db().doc(`${COL.TOKEN}/${tokenUid}`).get();
    expect(helper.token.mintingData?.tokensInVault).toBe(0);

    const statsDocRef = build5Db().doc(`${COL.TOKEN}/${tokenUid}/${SUB_COL.STATS}/${tokenUid}`);
    const tokenStats = <TokenStats>await statsDocRef.get();
    expect(tokenStats.stakes![stakeType]?.amount).toBe(1);
    expect(tokenStats.stakes![stakeType]?.totalAmount).toBe(1);
    expect(tokenStats.stakes![stakeType]?.value).toBe(1);
    expect(tokenStats.stakes![stakeType]?.totalValue).toBe(1);

    distribution = <TokenDistribution>await distributionDocRef.get();
    expect(distribution.stakes![stakeType]?.amount).toBe(1);
    expect(distribution.stakes![stakeType]?.totalAmount).toBe(1);
    expect(distribution.stakes![stakeType]?.value).toBe(1);
    expect(distribution.stakes![stakeType]?.totalValue).toBe(1);
    expect(distribution.totalUnclaimedAirdrop).toBe(0);
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

    const airdropQuery = build5Db().collection(COL.AIRDROP).where('member', '==', helper.member);
    let airdropsSnap = await airdropQuery.get();
    expect(airdropsSnap.length).toBe(1);
    const airdrop = <TokenDrop>airdropsSnap[0];
    expect(airdrop.vestingAt.toDate()).toEqual(drops[0].vestingAt);
    expect(airdrop.count).toEqual(drops[0].count);
    expect(airdrop.member).toEqual(drops[0].recipient);
    expect(airdrop.stakeType).toEqual(drops[0].stakeType);
    expect(airdrop.token).toEqual(helper.token?.uid!);
    expect(airdrop.status).toEqual(TokenDropStatus.DEPOSIT_NEEDED);

    const guardianDocRef = build5Db().doc(`${COL.MEMBER}/${helper.guardian}`);
    const guardian = <Member>await guardianDocRef.get();
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
      nativeTokens: [{ id: helper.token?.mintingData?.tokenId!, amount: BigInt(1) }],
    });

    await wait(async () => {
      const airdropsSnap = await airdropQuery.get<TokenDrop>();
      return airdropsSnap.length === 1 && airdropsSnap[0]?.status === TokenDropStatus.UNCLAIMED;
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
      const docRef = build5Db().doc(`${COL.TRANSACTION}/${order.uid}`);
      order = <Transaction>await docRef.get();
      return order.payload.unclaimedAirdrops === 0;
    });

    await awaitTransactionConfirmationsForToken(helper.token!.uid);

    const distributionDocRef = build5Db().doc(
      `${COL.TOKEN}/${helper.token!.uid}/${SUB_COL.DISTRIBUTION}/${helper.member}`,
    );
    const distribution = <TokenDistribution | undefined>await distributionDocRef.get();
    expect(distribution?.stakes![stakeType].value).toBe(2);

    airdropsSnap = await airdropQuery.get();
    expect(airdropsSnap.length).toBe(1);
    expect((<TokenDrop>airdropsSnap[0]).status).toBe(TokenDropStatus.CLAIMED);
  });
});
