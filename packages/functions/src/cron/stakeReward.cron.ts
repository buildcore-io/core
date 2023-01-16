import {
  COL,
  Entity,
  Space,
  Stake,
  StakeReward,
  StakeRewardStatus,
  StakeType,
  SUB_COL,
  Timestamp,
  Token,
  TokenDistribution,
  TokenDrop,
  TokenDropStatus,
  Transaction,
  TransactionIgnoreWalletReason,
  TransactionType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { isEmpty, last } from 'lodash';
import admin, { inc } from '../admin.config';
import { LastDocType } from '../utils/common.utils';
import { cOn, dateToTimestamp, uOn } from '../utils/dateTime.utils';
import { getRandomEthAddress } from '../utils/wallet.utils';

export const stakeRewardCronTask = async () => {
  const stakeRewards = await getDueStakeRewards();

  for (const stakeReward of stakeRewards) {
    const stakeRewardDocRef = admin.firestore().doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`);
    await stakeRewardDocRef.update(uOn({ status: StakeRewardStatus.PROCESSED }));
    try {
      const { totalAirdropped, totalStaked } = await executeStakeRewardDistribution(stakeReward);
      await stakeRewardDocRef.update(uOn({ totalStaked, totalAirdropped }));
    } catch (error) {
      functions.logger.error('Stake reward error', stakeReward.uid, error);
      await stakeRewardDocRef.update(uOn({ status: StakeRewardStatus.ERROR }));
    }
  }
};

const executeStakeRewardDistribution = async (stakeReward: StakeReward) => {
  const stakedPerMember = await getStakedPerMember(stakeReward);
  if (isEmpty(stakedPerMember)) {
    await admin
      .firestore()
      .doc(`${COL.STAKE_REWARD}/${stakeReward.uid}`)
      .update(uOn({ status: StakeRewardStatus.PROCESSED_NO_STAKES }));
    return { totalStaked: 0, totalAirdropped: 0 };
  }

  const totalStaked = Object.values(stakedPerMember).reduce((acc, act) => acc + act, 0);

  const token = <Token>(
    (await admin.firestore().doc(`${COL.TOKEN}/${stakeReward.token}`).get()).data()
  );
  const totalAirdropped = await createAirdrops(token, stakeReward, totalStaked, stakedPerMember);
  return { totalStaked, totalAirdropped };
};

// const STAKE_QUERY_LIMT = 1000;
export const getStakedPerMember = async (stakeReward: StakeReward) => {
  const stakedPerMember: { [key: string]: number } = {};
  let lastDoc: LastDocType | undefined = undefined;

  do {
    let query = admin
      .firestore()
      .collection(COL.STAKE)
      .where('token', '==', stakeReward.token)
      .where('type', '==', StakeType.DYNAMIC)
      .limit(500);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snap = await query.get();
    lastDoc = last(snap.docs);

    snap.docs
      .filter((doc) => {
        const stake = <Stake>doc.data();
        return (
          isBeforeOrEqual(stake.createdOn!, stakeReward.endDate) &&
          isAfterOrEqual(stake.expiresAt, stakeReward.startDate)
        );
      })
      .forEach((d) => {
        const stake = d.data() as Stake;
        stakedPerMember[stake.member] = (stakedPerMember[stake.member] || 0) + stake.value;
      });
  } while (lastDoc);

  return stakedPerMember;
};

// const getStartDoc = async (query: Query, stakeReward: StakeReward) => {
//   let snap = await query
//     .where('leftCheck', '<', stakeReward.leftCheck)
//     .orderBy('leftCheck', 'desc')
//     .limit(1)
//     .get();
//   let doc = head(snap.docs);
//   if (doc) {
//     return { doc, inclusive: false };
//   }
//   snap = await query.orderBy('createdOn').orderBy('expiresAt').limit(1).get();
//   doc = head(snap.docs);
//   return { doc, inclusive: true };
// };

// const getEndDoc = async (query: Query, stakeReward: StakeReward) => {
//   let snap = await query
//     .where('rightCheck', '>', stakeReward.rightCheck)
//     .orderBy('rightCheck')
//     .limit(1)
//     .get();
//   let doc = head(snap.docs);
//   if (doc) {
//     return { doc, inclusive: false };
//   }
//   snap = await query.orderBy('createdOn', 'desc').orderBy('expiresAt', 'desc').limit(1).get();
//   doc = head(snap.docs);
//   return { doc, inclusive: true };
// };

const getDueStakeRewards = async () => {
  const snap = await admin
    .firestore()
    .collection(COL.STAKE_REWARD)
    .where('status', '==', StakeRewardStatus.UNPROCESSED)
    .where('endDate', '<=', dateToTimestamp(dayjs()))
    .get();
  return snap.docs.map((d) => d.data() as StakeReward);
};

const createAirdrops = async (
  token: Token,
  stakeReward: StakeReward,
  totalStaked: number,
  stakedPerMember: { [key: string]: number },
) => {
  const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()).data();

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

    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${reward.member}`);
    const distribution = <TokenDistribution>(await distributionDocRef.get()).data();

    if (distribution.extraStakeRewards && distribution.extraStakeRewards > 0) {
      await distributionDocRef.update(uOn({ extraStakeRewards: inc(-reward.value) }));

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
      await admin.firestore().doc(`${COL.TRANSACTION}/${billPayment.uid}`).create(billPayment);

      const remainingExtra = distribution.extraStakeRewards - reward.value;
      if (remainingExtra >= 0) {
        return 0;
      }
      reward.value = Math.abs(remainingExtra);
    }

    const batch = admin.firestore().batch();
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
    const airdropDocRef = admin.firestore().doc(`${COL.AIRDROP}/${airdrop.uid}`);
    batch.create(airdropDocRef, cOn(airdrop));

    batch.set(distributionDocRef, { stakeRewards: inc(reward.value) }, { merge: true });
    await batch.commit();

    return reward.value;
  });

  return (await Promise.all(promises)).reduce((acc, act) => acc + act, 0);
};

const isBeforeOrEqual = (a: Timestamp, b: Timestamp) =>
  dayjs(a.toDate()).isBefore(dayjs(b.toDate())) || dayjs(a.toDate()).isSame(dayjs(b.toDate()));

const isAfterOrEqual = (a: Timestamp, b: Timestamp) =>
  dayjs(a.toDate()).isAfter(dayjs(b.toDate())) || dayjs(a.toDate()).isSame(dayjs(b.toDate()));
