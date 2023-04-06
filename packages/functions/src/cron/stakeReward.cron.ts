import {
  COL,
  Entity,
  Space,
  Stake,
  StakeReward,
  StakeRewardStatus,
  StakeType,
  SUB_COL,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  TransactionIgnoreWalletReason,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions/v2';
import { isEmpty, last } from 'lodash';
import { getSnapshot, soonDb } from '../firebase/firestore/soondb';
import { serverTime } from '../utils/dateTime.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';
export const stakeRewardCronTask = async () => {
  const stakeRewards = await getDueStakeRewards();

  for (const stakeReward of stakeRewards) {
    const stakeRewardDocRef = soonDb().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
    await stakeRewardDocRef.update({ status: StakeRewardStatus.PROCESSED });
    try {
      const { totalAirdropped, totalStaked } = await executeStakeRewardDistribution(stakeReward);
      await stakeRewardDocRef.update({ totalStaked, totalAirdropped });
    } catch (error) {
      functions.logger.error('Stake reward error', stakeReward.uid, error);
      await stakeRewardDocRef.update({ status: StakeRewardStatus.ERROR });
    }
  }
};

const executeStakeRewardDistribution = async (stakeReward: StakeReward) => {
  const stakedPerMember = await getStakedPerMember(stakeReward);
  if (isEmpty(stakedPerMember)) {
    await soonDb()
      .doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`)
      .update({ status: StakeRewardStatus.PROCESSED_NO_STAKES });
    return { totalStaked: 0, totalAirdropped: 0 };
  }

  const totalStaked = Object.values(stakedPerMember).reduce((acc, act) => acc + act, 0);

  const token = <Token>await soonDb().doc(`${COL.TOKEN}/${stakeReward.token}`).get();
  const totalAirdropped = await createAirdrops(token, stakeReward, totalStaked, stakedPerMember);
  return { totalStaked, totalAirdropped };
};

export const getStakedPerMember = async (stakeReward: StakeReward) => {
  const stakedPerMember: { [key: string]: number } = {};
  let lastDocId = '';

  do {
    const lastDoc = await getSnapshot(COL.STAKE, lastDocId);
    const snap = await soonDb()
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
    snap
      .filter((stake) => dayjs(stake.createdOn?.toDate()).isBefore(stakeReward.endDate.toDate()))
      .forEach((stake) => {
        stakedPerMember[stake.member] = (stakedPerMember[stake.member] || 0) + stake.value;
      });
  } while (lastDocId);

  return stakedPerMember;
};

const getDueStakeRewards = () =>
  soonDb()
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
  const space = <Space>await soonDb().doc(`${COL.SPACE}/${token.space}`).get();

  const rewards = Object.entries(stakedPerMember)
    .map(([member, staked]) => ({
      member,
      staked,
      value: Math.floor((staked / totalStaked) * stakeReward.tokensToDistribute),
    }))
    .sort((a, b) => b.staked - a.staked);
  const totalReward = rewards.reduce((acc, act) => acc + act.value, 0);

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

    const distributionDocRef = soonDb().doc(
      `${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${reward.member}`,
    );
    const distribution = <TokenDistribution>await distributionDocRef.get();

    if (distribution.extraStakeRewards && distribution.extraStakeRewards > 0) {
      await distributionDocRef.update({ extraStakeRewards: soonDb().inc(-reward.value) });

      const billPayment = <Transaction>{
        type: TransactionType.BILL_PAYMENT,
        uid: getRandomEthAddress(),
        member: reward.member,
        space: token.space,
        network: token.mintingData!.network,
        ignoreWallet: true,
        ignoreWalletReason: TransactionIgnoreWalletReason.EXTRA_STAKE_REWARD,
        payload: {
          amount: 0,
          nativeTokens: [
            {
              id: token.mintingData!.tokenId!,
              amount: Math.min(distribution.extraStakeRewards, reward.value),
            },
          ],
          ownerEntity: Entity.MEMBER,
          owner: reward.member,
          stakeReward: stakeReward.uid,
        },
      };
      await soonDb().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment);

      const remainingExtra = distribution.extraStakeRewards - reward.value;
      if (remainingExtra >= 0) {
        return 0;
      }
      reward.value = Math.abs(remainingExtra);
    }

    const batch = soonDb().batch();
    const airdrop: TokenDrop = {
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
    const airdropDocRef = soonDb().doc(`${COL.AIRDROP}/${airdrop.uid}`);
    batch.create(airdropDocRef, airdrop);

    batch.set(distributionDocRef, { stakeRewards: soonDb().inc(reward.value) }, true);
    await batch.commit();

    return reward.value;
  });

  return (await Promise.all(promises)).reduce((acc, act) => acc + act, 0);
};
