import { addressBalance } from '@iota/iota.js-next';
import {
  COL,
  Member,
  MIN_IOTA_AMOUNT,
  Network,
  StakeReward,
  StakeRewardStatus,
  StakeType,
  SUB_COL,
  TokenDistribution,
  TokenDrop,
  TransactionIgnoreWalletReason,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash';
import admin from '../../src/admin.config';
import { claimMintedTokenOrder } from '../../src/controls/token-minting/claim-minted-token.control';
import { stakeRewardCronTask } from '../../src/cron/stakeReward.cron';
import { retryWallet } from '../../src/cron/wallet.cron';
import { getAddress } from '../../src/utils/address.utils';
import { dateToTimestamp } from '../../src/utils/dateTime.utils';
import { getRandomEthAddress } from '../../src/utils/wallet.utils';
import { createMember, mockWalletReturnValue, wait } from '../../test/controls/common';
import { testEnv } from '../../test/set-up';
import { awaitTransactionConfirmationsForToken } from '../common';
import { requestFundsFromFaucet, requestMintedTokenFromFaucet } from '../faucet';
import { Helper } from './Helper';

describe('Stake reward test test', () => {
  const helper = new Helper();

  beforeAll(async () => {
    await helper.beforeAll();
  });

  beforeEach(async () => {
    await helper.beforeEach();
  });

  const verifyMemberAirdrop = async (member: string, count: number) => {
    const airdropQuery = admin.firestore().collection(COL.AIRDROP).where('member', '==', member);
    await wait(async () => {
      const snap = await airdropQuery.get();
      return snap.size > 0;
    });
    const snap = await airdropQuery.get();
    const airdrops = snap.docs.map((d) => d.data() as TokenDrop);
    expect(airdrops.length).toBe(1);

    expect(airdrops[0].sourceAddress).toBe(helper.space?.vaultAddress);
    expect(airdrops[0].count).toBe(count);
    expect(dayjs().add(1, 'y').subtract(5, 'm').isBefore(airdrops[0].vestingAt.toDate())).toBe(
      true,
    );
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token!.uid}/${SUB_COL.DISTRIBUTION}/${member}`);
    const distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.stakeRewards).toBe(count);
  };

  it('Should set status to processed_no_stakes', async () => {
    let stakeReward: StakeReward = {
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(dayjs().subtract(1, 'h')),
      endDate: dateToTimestamp(dayjs()),
      tokenVestingDate: dateToTimestamp(dayjs().add(1, 'y')),

      tokensToDistribute: 9538831184,
      token: helper.token?.uid!,
      status: StakeRewardStatus.UNPROCESSED,

      leftCheck: dayjs().subtract(1, 'h').valueOf(),
      rightCheck: dayjs().valueOf(),
    };
    const stakeRewardDocRef = admin.firestore().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
    await stakeRewardDocRef.create(stakeReward);
    await stakeRewardCronTask();

    stakeReward = (await stakeRewardDocRef.get()).data() as StakeReward;
    expect(stakeReward.status).toBe(StakeRewardStatus.PROCESSED_NO_STAKES);
    expect(stakeReward.totalAirdropped).toBe(0);
    expect(stakeReward.totalStaked).toBe(0);
  });

  it('Should create reward airdrops for two', async () => {
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      helper.memberAddress!,
      helper.TOKEN_ID,
      helper.VAULT_MNEMONIC,
      1000,
    );
    await helper.stakeAmount(1000, 26);
    await helper.validateStatsStakeAmount(1000, 1000, 1490, 1490, StakeType.DYNAMIC, 1);

    const member2Uid = await createMember(helper.walletSpy);
    const member2 = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${member2Uid}`).get()).data()
    );
    const member2Address = await helper.walletService?.getAddressDetails(
      getAddress(member2, helper.network)!,
    )!;
    await requestFundsFromFaucet(helper.network, member2Address.bech32, 10 * MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      member2Address,
      helper.TOKEN_ID,
      helper.VAULT_MNEMONIC,
      500,
    );
    await helper.stakeAmount(500, 26, undefined, undefined, undefined, member2Uid);
    await helper.validateStatsStakeAmount(1500, 1500, 2235, 2235, StakeType.DYNAMIC, 2);

    let stakeReward: StakeReward = {
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(dayjs()),
      endDate: dateToTimestamp(dayjs()),
      tokenVestingDate: dateToTimestamp(dayjs().add(1, 'y')),

      tokensToDistribute: 4470,
      token: helper.token?.uid!,
      status: StakeRewardStatus.UNPROCESSED,

      leftCheck: dayjs().valueOf(),
      rightCheck: dayjs().valueOf(),
    };
    const stakeRewardDocRef = admin.firestore().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
    await stakeRewardDocRef.create(stakeReward);
    await stakeRewardCronTask();

    await verifyMemberAirdrop(helper.member!.uid, 2980);
    await verifyMemberAirdrop(member2Uid, 1490);

    await wait(async () => {
      const stakeReward = (await stakeRewardDocRef.get()).data() as StakeReward;
      return stakeReward.status === StakeRewardStatus.PROCESSED;
    });

    stakeReward = (await stakeRewardDocRef.get()).data() as StakeReward;
    expect(stakeReward.totalStaked).toBe(2235);
    expect(stakeReward.totalAirdropped).toBe(4470);
  });

  it('Should create reward airdrops and claim it', async () => {
    const vaultAddress = await helper.walletService!.getAddressDetails(helper.space?.vaultAddress!);
    await requestFundsFromFaucet(helper.network, vaultAddress.bech32, MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      vaultAddress,
      helper.TOKEN_ID,
      helper.VAULT_MNEMONIC,
      149,
    );

    await helper.stakeAmount(100, 26);
    const stakeReward: StakeReward = {
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(dayjs().subtract(1, 'h')),
      endDate: dateToTimestamp(dayjs()),
      tokenVestingDate: dateToTimestamp(dayjs().add(1, 'y')),

      tokensToDistribute: 149,
      token: helper.token?.uid!,
      status: StakeRewardStatus.UNPROCESSED,

      leftCheck: dayjs().subtract(1, 'h').valueOf(),
      rightCheck: dayjs().valueOf(),
    };
    const stakeRewardDocRef = admin.firestore().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
    await stakeRewardDocRef.create(stakeReward);
    await stakeRewardCronTask();

    await verifyMemberAirdrop(helper.member!.uid, 149);

    mockWalletReturnValue(helper.walletSpy, helper.member!.uid, {
      token: helper.token!.uid,
    });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    await wait(async () => {
      const snap = await admin
        .firestore()
        .collection(COL.TRANSACTION)
        .where('member', '==', helper.member!.uid)
        .where('type', '==', TransactionType.BILL_PAYMENT)
        .get();
      return snap.size === 2;
    });

    await awaitTransactionConfirmationsForToken(helper.token?.uid!);

    const member = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${helper.member?.uid}`).get()).data()
    );
    for (const address of [helper.memberAddress?.bech32!, getAddress(member, Network.RMS)]) {
      const outputs = await helper.walletService!.getOutputs(address, [], false, true);
      const nativeTokens = Object.values(outputs).reduce(
        (acc, act) => acc + Number(act.nativeTokens![0].amount),
        0,
      );
      expect(nativeTokens).toBe(address === helper.memberAddress?.bech32! ? 100 : 149);
    }

    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token?.uid}/${SUB_COL.DISTRIBUTION}/${helper.member?.uid}`);
    await wait(async () => {
      const distribution = <TokenDistribution>(await distributionDocRef.get()).data();
      return (
        distribution.stakes![StakeType.DYNAMIC].amount === 249 &&
        distribution.stakes![StakeType.DYNAMIC].value === 447
      );
    });
  });

  it('Should fail first then proceed, not enough balance', async () => {
    await helper.stakeAmount(100, 26);

    const stakeReward: StakeReward = {
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(dayjs().subtract(1, 'h')),
      endDate: dateToTimestamp(dayjs()),
      tokenVestingDate: dateToTimestamp(dayjs().add(1, 'y')),

      tokensToDistribute: 149,
      token: helper.token?.uid!,
      status: StakeRewardStatus.UNPROCESSED,

      leftCheck: dayjs().subtract(1, 'h').valueOf(),
      rightCheck: dayjs().add(1, 'y').valueOf(),
    };
    const stakeRewardDocRef = admin.firestore().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
    await stakeRewardDocRef.create(stakeReward);
    await stakeRewardCronTask();

    await verifyMemberAirdrop(helper.member!.uid, 149);

    mockWalletReturnValue(helper.walletSpy, helper.member!.uid, {
      token: helper.token!.uid,
    });
    const claimOrder = await testEnv.wrap(claimMintedTokenOrder)({});
    await requestFundsFromFaucet(
      helper.network,
      claimOrder.payload.targetAddress,
      claimOrder.payload.amount,
    );

    const query = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.member!.uid)
      .where('type', '==', TransactionType.BILL_PAYMENT);
    let failed: any;
    await wait(async () => {
      const snap = await query.get();
      failed = snap.docs.find((d) => d.data()?.payload?.walletReference?.count === 5);
      return snap.size === 2 && failed !== undefined;
    });
    const vaultAddress = await helper.walletService!.getAddressDetails(helper.space?.vaultAddress!);
    await requestFundsFromFaucet(helper.network, vaultAddress.bech32, MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      vaultAddress,
      helper.TOKEN_ID,
      helper.VAULT_MNEMONIC,
      149,
    );

    await wait(async () => {
      const balance = await addressBalance(
        helper.walletService!.client,
        helper.space!.vaultAddress!,
      );
      return !isEmpty(balance.nativeTokens);
    });

    if (failed) {
      await failed.ref.update({
        'payload.walletReference.count': 4,
        'payload.walletReference.processedOn': dateToTimestamp(dayjs().subtract(1, 'h')),
      });
    }
    await retryWallet();

    await awaitTransactionConfirmationsForToken(helper.token?.uid!);

    const member = <Member>(
      (await admin.firestore().doc(`${COL.MEMBER}/${helper.member?.uid}`).get()).data()
    );
    for (const address of [helper.memberAddress?.bech32!, getAddress(member, Network.RMS)]) {
      const outputs = await helper.walletService!.getOutputs(address, [], false, true);
      const nativeTokens = Object.values(outputs).reduce(
        (acc, act) => acc + Number(act.nativeTokens![0].amount),
        0,
      );
      expect(nativeTokens).toBe(address === helper.memberAddress?.bech32! ? 100 : 149);
    }
  });

  it('Should only pick stakes for the given period', async () => {
    const vaultAddress = await helper.walletService!.getAddressDetails(helper.space?.vaultAddress!);
    await requestFundsFromFaucet(helper.network, vaultAddress.bech32, MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      vaultAddress,
      helper.TOKEN_ID,
      helper.VAULT_MNEMONIC,
      149,
    );

    await helper.stakeAmount(50, 26);
    await helper.stakeAmount(25, 26);
    const stake = await helper.stakeAmount(12, 26);
    await admin
      .firestore()
      .doc(`${COL.STAKE}/${stake.uid}`)
      .update({
        createdOn: dateToTimestamp(dayjs().subtract(3, 'h')),
        expiresAt: dateToTimestamp(dayjs().subtract(2, 'h')),
        leftCheck: dayjs().subtract(2, 'h').valueOf(),
        rightCheck: dayjs().subtract(3, 'h').valueOf(),
      });
    const stake2 = await helper.stakeAmount(13, 26);
    await admin
      .firestore()
      .doc(`${COL.STAKE}/${stake2.uid}`)
      .update({
        createdOn: dateToTimestamp(dayjs().add(2, 'h')),
        expiresAt: dateToTimestamp(dayjs().add(3, 'h')),
        leftCheck: dayjs().add(3, 'h').valueOf(),
        rightCheck: dayjs().add(2, 'h').valueOf(),
      });

    let stakeReward: StakeReward = {
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(dayjs()),
      endDate: dateToTimestamp(dayjs()),
      tokenVestingDate: dateToTimestamp(dayjs().add(1, 'y')),

      tokensToDistribute: 111,
      token: helper.token?.uid!,
      status: StakeRewardStatus.UNPROCESSED,

      leftCheck: dayjs().valueOf(),
      rightCheck: dayjs().valueOf(),
    };
    const stakeRewardDocRef = admin.firestore().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
    await stakeRewardDocRef.create(stakeReward);
    await stakeRewardCronTask();

    await wait(async () => {
      const stakeReward = (await stakeRewardDocRef.get()).data() as StakeReward;
      return stakeReward.status === StakeRewardStatus.PROCESSED;
    });

    stakeReward = (await stakeRewardDocRef.get()).data() as StakeReward;
    expect(stakeReward.totalStaked).toBe(111);
    expect(stakeReward.totalAirdropped).toBe(111);
  });

  it('Should claim extras properly', async () => {
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${helper.token?.uid!}/${SUB_COL.DISTRIBUTION}/${helper.member?.uid}`);
    await distributionDocRef.set({ extraStakeRewards: 400 }, { merge: true });

    const vaultAddress = await helper.walletService!.getAddressDetails(helper.space?.vaultAddress!);
    await requestFundsFromFaucet(helper.network, vaultAddress.bech32, MIN_IOTA_AMOUNT);
    await requestMintedTokenFromFaucet(
      helper.walletService!,
      vaultAddress,
      helper.TOKEN_ID,
      helper.VAULT_MNEMONIC,
      149,
    );

    await helper.stakeAmount(100, 26);

    const stakeReward: StakeReward = {
      uid: getRandomEthAddress(),
      startDate: dateToTimestamp(dayjs().subtract(1, 'h')),
      endDate: dateToTimestamp(dayjs()),
      tokenVestingDate: dateToTimestamp(dayjs().add(1, 'y')),

      tokensToDistribute: 149,
      token: helper.token?.uid!,
      status: StakeRewardStatus.UNPROCESSED,

      leftCheck: dayjs().subtract(1, 'h').valueOf(),
      rightCheck: dayjs().valueOf(),
    };
    const stakeRewardDocRef = admin.firestore().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
    await stakeRewardDocRef.create(stakeReward);

    const billPaymentQuery = admin
      .firestore()
      .collection(COL.TRANSACTION)
      .where('member', '==', helper.member?.uid)
      .where('ignoreWalletReason', '==', TransactionIgnoreWalletReason.EXTRA_STAKE_REWARD);

    // No reward, 149 reduction
    await stakeRewardCronTask();
    let snap = await billPaymentQuery.get();
    expect(snap.size).toBe(1);
    await stakeRewardDocRef.update({ status: StakeRewardStatus.UNPROCESSED });
    let distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.extraStakeRewards).toBe(251);
    snap = await billPaymentQuery.get();
    expect(snap.docs[0].data()?.payload.nativeTokens[0]?.amount).toBe(149);

    // No reward, 149 reduction
    await stakeRewardCronTask();
    snap = await billPaymentQuery.get();
    expect(snap.size).toBe(2);
    await stakeRewardDocRef.update({ status: StakeRewardStatus.UNPROCESSED });
    distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.extraStakeRewards).toBe(102);

    //47 reward, 102 reduction
    await stakeRewardCronTask();
    snap = await billPaymentQuery.get();
    expect(snap.size).toBe(3);
    await stakeRewardDocRef.update({ status: StakeRewardStatus.UNPROCESSED });
    distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.extraStakeRewards).toBe(-47);
    expect((distribution.tokenDrops || [])[0]?.count).toBe(47);
    snap = await billPaymentQuery.get();
    expect(snap.docs.find((d) => d.data()?.payload.nativeTokens[0]?.amount === 102)).toBeDefined();

    //149, full reward
    await stakeRewardCronTask();
    snap = await billPaymentQuery.get();
    expect(snap.size).toBe(3);
    distribution = <TokenDistribution>(await distributionDocRef.get()).data();
    expect(distribution.extraStakeRewards).toBe(-47);
    expect((distribution.tokenDrops || [])[1]?.count).toBe(149);
  });
});
