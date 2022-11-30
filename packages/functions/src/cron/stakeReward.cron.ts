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
import { isEmpty, last } from 'lodash';
import admin, { inc } from '../admin.config';
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

const getStakedPerMember = async (stakeReward: StakeReward) => {
  const stakedPerMember: { [key: string]: number } = {};
  const docs: { [key: string]: boolean } = {};
  let lastDoc: LastDocType | undefined = undefined;
  do {
    const query = stakeQuery(stakeReward, 'createdOn', lastDoc);
    const snap = await query.get();
    lastDoc = last(snap.docs);
    snap.docs.forEach((d) => {
      const stake = <Stake>d.data();
      docs[d.id] = true;
      stakedPerMember[stake.member] = (stakedPerMember[stake.member] || 0) + stake.amount;
    });
  } while (lastDoc);
  lastDoc = undefined;

  do {
    const query = stakeQuery(stakeReward, 'expiresAt', lastDoc);
    const snap = await query.get();
    lastDoc = last(snap.docs);
    snap.docs
      .filter((d) => !docs[d.id])
      .forEach((d) => {
        const stake = <Stake>d.data();
        stakedPerMember[stake.member] = (stakedPerMember[stake.member] || 0) + stake.amount;
      });
  } while (lastDoc);

  return stakedPerMember;
};

const stakeQuery = (
  stakeReward: StakeReward,
  field: 'createdOn' | 'expiresAt',
  lastDoc?: LastDocType,
) => {
  let query = admin
    .firestore()
    .collection(COL.STAKE)
    .where('token', '==', stakeReward.token)
    .where(field, '>=', stakeReward.startDate)
    .where(field, '<=', stakeReward.endDate)
    .limit(STAKE_QUERY_LIMT);
  if (lastDoc) {
    query = query.startAfter(lastDoc);
  }
  return query;
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
    const distributionUpdateData = {
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
      stakeRewards: inc(dist.reward),
    };
    return distributionDocRef.set(uOn(distributionUpdateData), { merge: true });
  });

  await Promise.all(promises);
  return distributions.reduce((acc, act) => acc + act.reward, 0);
};
