import {
  COL,
  Space,
  Stake,
  StakeReward,
  StakeRewardStatus,
  SUB_COL,
  Token,
  TokenDrop,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import * as functions from 'firebase-functions';
import { last } from 'lodash';
import admin from '../admin.config';
import { LastDocType } from '../utils/common.utils';
import { dateToTimestamp, uOn } from '../utils/dateTime.utils';
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

const STAKE_QUERY_LIMT = 1000;
const executeStakeRewardDistribution = async (stakeReward: StakeReward) => {
  const stakedPerMember: { [key: string]: number } = {};
  let lastDoc: LastDocType | undefined = undefined;
  do {
    let query = admin
      .firestore()
      .collection(COL.STAKE)
      .where('token', '==', stakeReward.token)
      .where('createdOn', '>=', stakeReward.startDate)
      .where('createdOn', '<', stakeReward.endDate)
      .orderBy('createdOn')
      .limit(STAKE_QUERY_LIMT);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }
    const snap = await query.get();
    lastDoc = last(snap.docs);

    snap.docs.forEach((d) => {
      const stake = <Stake>d.data();
      stakedPerMember[stake.member] = (stakedPerMember[stake.member] || 0) + stake.amount;
    });
  } while (lastDoc);

  const totalStaked = Object.values(stakedPerMember).reduce((acc, act) => acc + act, 0);

  const token = <Token>(
    (await admin.firestore().doc(`${COL.TOKEN}/${stakeReward.token}`).get()).data()
  );
  const totalAirdropped = await createAirdrops(token, stakeReward, totalStaked, stakedPerMember);
  return { totalStaked, totalAirdropped };
};

const getDueStakeRewards = async () => {
  const snap = await admin
    .firestore()
    .collection(COL.STAKE_REWARD)
    .where('status', '==', StakeRewardStatus.UNPROCESSED)
    .where('endDate', '<=', dateToTimestamp(dayjs()))
    .get();
  return snap.docs.map((d) => <StakeReward>d.data());
};

const createAirdrops = async (
  token: Token,
  stakeReward: StakeReward,
  totalStaked: number,
  stakedPerMember: { [key: string]: number },
) => {
  const space = <Space>(await admin.firestore().doc(`${COL.SPACE}/${token.space}`).get()).data();

  const distributions = Object.entries(stakedPerMember)
    .map(([member, staked]) => ({
      member,
      staked,
      reward: Math.floor((staked / totalStaked) * stakeReward.tokensToDistribute),
    }))
    .sort((a, b) => b.staked - a.staked);
  const totalReward = distributions.reduce((acc, act) => acc + act.reward, 0);

  let tokensLeftToDistribute = stakeReward.tokensToDistribute - totalReward;
  let i = 0;
  while (tokensLeftToDistribute > 0) {
    distributions[i].reward += 1;
    i = (i + 1) % distributions.length;
    --tokensLeftToDistribute;
  }

  const promises = distributions.map((dist) => {
    const distributionDocRef = admin
      .firestore()
      .doc(`${COL.TOKEN}/${token.uid}/${SUB_COL.DISTRIBUTION}/${dist.member}`);
    if (!dist.reward) {
      return 0;
    }
    const airdropData = {
      parentId: token.uid,
      parentCol: COL.TOKEN,
      uid: dist.member,
      tokenDrops: admin.firestore.FieldValue.arrayUnion(<TokenDrop>{
        createdOn: dateToTimestamp(dayjs()),
        vestingAt: stakeReward.tokenVestingDate,
        count: dist.reward,
        uid: getRandomEthAddress(),
        sourceAddress: space.vaultAddress,
        stakeRewardId: stakeReward.uid,
      }),
    };
    return distributionDocRef.set(uOn(airdropData), { merge: true });
  });

  await Promise.all(promises);
  return distributions.reduce((acc, act) => acc + act.reward, 0);
};
