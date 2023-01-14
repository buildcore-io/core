import {
  COL,
  Space,
  Stake,
  StakeType,
  SUB_COL,
  tiers,
  TokenDistribution,
  tokenTradingFeeDicountPercentage,
} from '@soonaverse/interfaces';
import admin, { inc } from '../admin.config';
import { getTokenSaleConfig, isProdEnv } from '../utils/config.utils';
import { uOn } from '../utils/dateTime.utils';
import { getSoonToken } from '../utils/token.utils';

export const hasStakedSoonTokens = async (member: string, type?: StakeType) => {
  if (!isProdEnv()) {
    return true;
  }

  const soon = await getSoonToken();
  const distributionDoc = await admin
    .firestore()
    .doc(`${COL.TOKEN}/${soon.uid}/${SUB_COL.DISTRIBUTION}/${member}`)
    .get();
  const distribution = <TokenDistribution | undefined>distributionDoc.data();

  const stakeTypes = type ? [type] : Object.values(StakeType);
  const hasAny = stakeTypes.reduce(
    (acc, act) => acc || getStakeForType(distribution, act) >= tiers[1],
    false,
  );
  return hasAny;
};

export const getStakeForType = (distribution: TokenDistribution | undefined, type: StakeType) =>
  (distribution?.stakes || {})[type]?.value || 0;

export const onStakeCreated = async (transaction: admin.firestore.Transaction, stake: Stake) => {
  const distribution = await getTokenDistribution(transaction, stake.token, stake.member);
  if (stake.type === StakeType.DYNAMIC) {
    updateMemberTokenDiscountPercentage(transaction, distribution, stake.member, stake.value);
  }
  updateStakingMembersStats(transaction, distribution, stake.token, stake.type, stake.value);
};

export const onStakeExpired = async (transaction: admin.firestore.Transaction, stake: Stake) => {
  const distribution = await getTokenDistribution(transaction, stake.token, stake.member);
  if (stake.type === StakeType.DYNAMIC) {
    updateMemberTokenDiscountPercentage(transaction, distribution, stake.member, -stake.value);
    await removeMemberFromSpace(transaction, distribution, stake);
  }
  updateStakingMembersStats(transaction, distribution, stake.token, stake.type, -stake.value);
};

const getTokenDistribution = async (
  transaction: admin.firestore.Transaction,
  token: string,
  member: string,
) => {
  const distirbutionDocRef = admin
    .firestore()
    .doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`);
  return <TokenDistribution | undefined>(await transaction.get(distirbutionDocRef)).data();
};

const updateMemberTokenDiscountPercentage = (
  transaction: admin.firestore.Transaction,
  distribution: TokenDistribution | undefined,
  member: string,
  stakeValueDiff: number,
) => {
  const stakeValue = getStakeForType(distribution, StakeType.DYNAMIC) + stakeValueDiff;

  const tier = getTier(stakeValue);
  if (!tier && stakeValueDiff > 0) {
    return;
  }
  const discount = tokenTradingFeeDicountPercentage[tier] / 100;
  const tokenTradingFeePercentage = getTokenSaleConfig.percentage * (1 - discount);

  const memberDocRef = admin.firestore().doc(`${COL.MEMBER}/${member}`);
  transaction.update(memberDocRef, uOn({ tokenTradingFeePercentage }));
};

export const getTier = (stakeValue: number) => {
  let tier = 0;
  while (tiers[tier] <= stakeValue && tier < tiers.length) {
    ++tier;
  }
  return tier - 1;
};

const updateStakingMembersStats = (
  transaction: admin.firestore.Transaction,
  distribution: TokenDistribution | undefined,
  token: string,
  type: StakeType,
  stakeValueDiff: number,
) => {
  const tokenStatsDocRef = admin.firestore().doc(`${COL.TOKEN}/${token}/${SUB_COL.STATS}/${token}`);

  const prevStakedAmount = getStakeForType(distribution, type);
  if (!prevStakedAmount) {
    transaction.set(
      tokenStatsDocRef,
      { stakes: { [type]: { stakingMembersCount: inc(1) } } },
      { merge: true },
    );
    return;
  }

  const currentStakedAmount = prevStakedAmount + stakeValueDiff;
  if (!currentStakedAmount) {
    transaction.set(
      tokenStatsDocRef,
      { stakes: { [type]: { stakingMembersCount: inc(-1) } } },
      { merge: true },
    );
    return;
  }
};

const removeMemberFromSpace = async (
  transaction: admin.firestore.Transaction,
  distribution: TokenDistribution | undefined,
  stake: Stake,
) => {
  const spaceDocRef = admin.firestore().doc(`${COL.SPACE}/${stake.space}`);
  const space = <Space>(await spaceDocRef.get()).data();
  const stakedValue = getStakeForType(distribution, stake.type) - stake.value;
  if (!space.tokenBased || stakedValue >= (space.minStakedValue || 0)) {
    return;
  }

  const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(stake.member);
  const isGuardian = (await spaceDocRef.get()).exists;
  if (isGuardian && space.totalGuardians > 1) {
    transaction.delete(guardianDocRef);
  }
  if (space.totalMembers > 1) {
    const memberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(stake.member);
    transaction.delete(memberDocRef);
  }
  transaction.update(
    spaceDocRef,
    uOn({
      totalGuardians: inc(isGuardian && space.totalGuardians > 1 ? -1 : 0),
      totalMembers: inc(space.totalMembers > 1 ? -1 : 0),
    }),
  );
};
