import {
  COL,
  Space,
  Stake,
  StakeType,
  SUB_COL,
  tiers,
  TokenDistribution,
  tokenTradingFeeDicountPercentage,
} from '@build-5/interfaces';
import { ITransaction } from '../firebase/firestore/interfaces';
import { soonDb } from '../firebase/firestore/soondb';
import { getTokenSaleConfig, isProdEnv } from '../utils/config.utils';
import { getSoonToken } from '../utils/token.utils';

export const hasStakedSoonTokens = async (member: string, type?: StakeType) => {
  if (!isProdEnv()) {
    return true;
  }

  const soon = await getSoonToken();
  const distributionDocRef = soonDb().doc(
    `${COL.TOKEN}/${soon.uid}/${SUB_COL.DISTRIBUTION}/${member}`,
  );
  const distribution = (await distributionDocRef.get<TokenDistribution>())!;

  const stakeTypes = type ? [type] : Object.values(StakeType);
  const hasAny = stakeTypes.reduce(
    (acc, act) => acc || getStakeForType(distribution, act) >= tiers[1],
    false,
  );
  return hasAny;
};

export const getStakeForType = (distribution: TokenDistribution | undefined, type: StakeType) =>
  (distribution?.stakes || {})[type]?.value || 0;

export const onStakeCreated = async (transaction: ITransaction, stake: Stake) => {
  const distribution = await getTokenDistribution(transaction, stake.token, stake.member);
  if (stake.type === StakeType.DYNAMIC) {
    updateMemberTokenDiscountPercentage(transaction, distribution, stake.member, stake.value);
  }
  updateStakingMembersStats(transaction, distribution, stake.token, stake.type, stake.value);
};

export const onStakeExpired = async (transaction: ITransaction, stake: Stake) => {
  const distribution = await getTokenDistribution(transaction, stake.token, stake.member);
  if (stake.type === StakeType.DYNAMIC) {
    updateMemberTokenDiscountPercentage(transaction, distribution, stake.member, -stake.value);
    await removeMemberFromSpace(transaction, distribution, stake);
  }
  updateStakingMembersStats(transaction, distribution, stake.token, stake.type, -stake.value);
};

const getTokenDistribution = async (transaction: ITransaction, token: string, member: string) => {
  const distirbutionDocRef = soonDb().doc(
    `${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`,
  );
  return await transaction.get<TokenDistribution>(distirbutionDocRef);
};

const updateMemberTokenDiscountPercentage = (
  transaction: ITransaction,
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

  const memberDocRef = soonDb().doc(`${COL.MEMBER}/${member}`);
  transaction.update(memberDocRef, { tokenTradingFeePercentage });
};

export const getTier = (stakeValue: number) => {
  let tier = 0;
  while (tiers[tier] <= stakeValue && tier < tiers.length) {
    ++tier;
  }
  return tier - 1;
};

const updateStakingMembersStats = (
  transaction: ITransaction,
  distribution: TokenDistribution | undefined,
  token: string,
  type: StakeType,
  stakeValueDiff: number,
) => {
  const tokenStatsDocRef = soonDb().doc(`${COL.TOKEN}/${token}/${SUB_COL.STATS}/${token}`);

  const prevStakedAmount = getStakeForType(distribution, type);
  if (!prevStakedAmount) {
    transaction.set(
      tokenStatsDocRef,
      { stakes: { [type]: { stakingMembersCount: soonDb().inc(1) } } },
      true,
    );
    return;
  }

  const currentStakedAmount = prevStakedAmount + stakeValueDiff;
  if (!currentStakedAmount) {
    transaction.set(
      tokenStatsDocRef,
      { stakes: { [type]: { stakingMembersCount: soonDb().inc(-1) } } },
      true,
    );
    return;
  }
};

const removeMemberFromSpace = async (
  transaction: ITransaction,
  distribution: TokenDistribution | undefined,
  stake: Stake,
) => {
  const spaceDocRef = soonDb().doc(`${COL.SPACE}/${stake.space}`);
  const space = (await spaceDocRef.get<Space>())!;
  const stakedValue = getStakeForType(distribution, stake.type) - stake.value;
  if (!space.tokenBased || stakedValue >= (space.minStakedValue || 0)) {
    return;
  }

  const guardianDocRef = spaceDocRef.collection(SUB_COL.GUARDIANS).doc(stake.member);
  const isGuardian = (await spaceDocRef.get()) !== undefined;
  if (isGuardian && space.totalGuardians > 1) {
    transaction.delete(guardianDocRef);
  }
  if (space.totalMembers > 1) {
    const memberDocRef = spaceDocRef.collection(SUB_COL.MEMBERS).doc(stake.member);
    transaction.delete(memberDocRef);
  }
  transaction.update(spaceDocRef, {
    totalGuardians: soonDb().inc(isGuardian && space.totalGuardians > 1 ? -1 : 0),
    totalMembers: soonDb().inc(space.totalMembers > 1 ? -1 : 0),
  });
};
