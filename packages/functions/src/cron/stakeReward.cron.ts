import { build5Db, getSnapshot } from '@build-5/database';
import {
  COL,
  Entity,
  IgnoreWalletReason,
  SUB_COL,
  Space,
  Stake,
  StakeReward,
  StakeRewardStatus,
  StakeType,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  TransactionType,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import { isEmpty, last } from 'lodash';
import { getProject } from '../utils/common.utils';
import { serverTime } from '../utils/dateTime.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const onStakeRewardExpired = async () => {
  const stakeRewards = await getDueStakeRewards();

  for (const stakeReward of stakeRewards) {
    console.log('processing', stakeReward.uid);
    const stakeRewardDocRef = build5Db().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
    await stakeRewardDocRef.update({ status: StakeRewardStatus.PROCESSED });
    try {
      const { totalAirdropped, totalStaked } = await executeStakeRewardDistribution(stakeReward);
      console.log('totalAirdropped', totalAirdropped, totalStaked);
      await stakeRewardDocRef.update({ totalStaked, totalAirdropped });
    } catch (error) {
      console.error('Stake reward error', stakeReward.uid, error);
      await stakeRewardDocRef.update({ status: StakeRewardStatus.ERROR });
    }
  }
};

const executeStakeRewardDistribution = async (stakeReward: StakeReward) => {
  const stakedPerMember = await getStakedPerMember(stakeReward);
  console.log('Staking members count', Object.keys(stakedPerMember).length);
  if (isEmpty(stakedPerMember)) {
    await build5Db()
      .doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`)
      .update({ status: StakeRewardStatus.PROCESSED_NO_STAKES });
    return { totalStaked: 0, totalAirdropped: 0 };
  }

  const totalStaked = Object.values(stakedPerMember).reduce((acc, act) => acc + act, 0);
  console.log('Total staked', totalStaked);

  const token = <Token>await build5Db().doc(`${COL.TOKEN}/${stakeReward.token}`).get();
  const totalAirdropped = await createAirdrops(token, stakeReward, totalStaked, stakedPerMember);
  return { totalStaked, totalAirdropped };
};

export const getStakedPerMember = async (stakeReward: StakeReward) => {
  const stakedPerMember: { [key: string]: number } = {};
  let lastDocId = '';
  const rewardEndDate = stakeReward.endDate.toDate();
  do {
    const lastDoc = await getSnapshot(COL.STAKE, lastDocId);
    const snap = await build5Db()
      .collection(COL.STAKE)
      .where('token', '==', stakeReward.token)
      .where('type', '==', StakeType.DYNAMIC)
      .where('expiresAt', '>=', stakeReward.startDate)
      .orderBy('expiresAt')
      .startAfter(lastDoc)
      .limit(2000)
      .select('createdOn', 'member', 'value')
      .get<Stake>();
    lastDocId = last(snap)?.uid || '';
    snap.forEach((stake) => {
      if (dayjs(stake.createdOn?.toDate()).isAfter(rewardEndDate)) {
        return;
      }
      stakedPerMember[stake.member] = (stakedPerMember[stake.member] || 0) + stake.value;
    });
  } while (lastDocId);

  return stakedPerMember;
};

const getDueStakeRewards = () =>
  build5Db()
    .collection(COL.STAKE_REWARD)
    .where('status', '==', StakeRewardStatus.UNPROCESSED)
    .where('endDate', '<=', serverTime())
    .get<StakeReward>();

const createAirdrops = async (
  token: Token,
  stakeReward: StakeReward,
  totalStaked: number,
  stakedPerMember: { [key: string]: number },
) => {
  const space = <Space>await build5Db().doc(`${COL.SPACE}/${token.space}`).get();

  const rewards = Object.entries(stakedPerMember)
    .map(([member, staked]) => ({
      member,
      staked,
      value: Math.floor((staked / totalStaked) * stakeReward.tokensToDistribute),
    }))
    .sort((a, b) => b.staked - a.staked);
  const totalReward = rewards.reduce((acc, act) => acc + act.value, 0);
  console.log('totalReward', totalReward);

  let tokensLeftToDistribute = stakeReward.tokensToDistribute - totalReward;
  let i = 0;
  while (tokensLeftToDistribute > 0) {
    rewards[i].value += 1;
    i = (i + 1) % rewards.length;
    --tokensLeftToDistribute;
  }

  const promises = rewards.map(async (reward) => {
    if (!reward.value) {
      return 0;
    }

    console.log('Checkking distribution for', reward.member);
    const distributionDocRef = build5Db().doc(
      `${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${reward.member}`,
    );
    const distribution = await distributionDocRef.get<TokenDistribution>();

    if (distribution?.extraStakeRewards && distribution.extraStakeRewards > 0) {
      console.log('processing extra stake reward', reward.member);
      await distributionDocRef.update({
        parentId: token.uid,
        parentCol: COL.TOKEN,
        uid: reward.member,
        extraStakeRewards: build5Db().inc(-reward.value),
      });

      const billPayment: Transaction = {
        project: getProject(stakeReward),
        type: TransactionType.BILL_PAYMENT,
        uid: getRandomEthAddress(),
        member: reward.member,
        space: token.space,
        network: token.mintingData!.network!,
        ignoreWallet: true,
        ignoreWalletReason: IgnoreWalletReason.EXTRA_STAKE_REWARD,
        payload: {
          amount: 0,
          nativeTokens: [
            {
              id: token.mintingData!.tokenId!,
              amount: BigInt(Math.min(distribution.extraStakeRewards, reward.value)),
            },
          ],
          ownerEntity: Entity.MEMBER,
          owner: reward.member,
          stakeReward: stakeReward.uid,
        },
      };
      await build5Db().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment);

      const remainingExtra = distribution.extraStakeRewards - reward.value;
      if (remainingExtra >= 0) {
        return 0;
      }
      reward.value = Math.abs(remainingExtra);
    }

    const batch = build5Db().batch();
    const airdrop: TokenDrop = {
      project: getProject(stakeReward),
      uid: getRandomEthAddress(),
      createdBy: 'system',
      member: reward.member,
      token: stakeReward.token,
      vestingAt: stakeReward.tokenVestingDate,
      count: reward.value,
      status: TokenDropStatus.UNCLAIMED,
      sourceAddress: space.vaultAddress,
      stakeRewardId: stakeReward.uid,
      stakeType: StakeType.DYNAMIC,
    };
    console.log('Creating airdrop', airdrop.uid);

    const airdropDocRef = build5Db().doc(`${COL.AIRDROP}/${airdrop.uid}`);
    batch.create(airdropDocRef, airdrop);

    batch.set(
      distributionDocRef,
      {
        parentId: token.uid,
        parentCol: COL.TOKEN,
        uid: reward.member,
        stakeRewards: build5Db().inc(reward.value),
      },
      true,
    );
    await batch.commit();

    console.log('Airdrop submited', airdrop.uid);

    return reward.value;
  });

  return (await Promise.all(promises)).reduce((acc, act) => acc + act, 0);
};
