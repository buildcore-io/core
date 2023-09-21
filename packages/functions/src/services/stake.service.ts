import { ITransaction, build5Db } from '@build-5/database';
import {
  COL,
  Project,
  ProjectBilling,
  SUB_COL,
  Space,
  Stake,
  StakeType,
  TokenDistribution,
} from '@build-5/interfaces';
import { getProject } from '../utils/common.utils';
import { getTokenSaleConfig } from '../utils/config.utils';

export const hasStakedTokens = async (projectId: string, member: string, type?: StakeType) => {
  const project = (await build5Db().get<Project>(COL.PROJECT, projectId))!;
  if (project.config?.billing !== ProjectBilling.TOKEN_BASE) {
    return true;
  }
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${project.config.baseTokenUid}`);
  const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member);
  const distribution = await distributionDocRef.get<TokenDistribution>();

  const stakeTypes = type ? [type] : Object.values(StakeType);
  const hasAny = stakeTypes.reduce(
    (acc, act) => acc || getStakeForType(distribution, act) >= (project.config.tiers || [])[1],
    false,
  );
  return hasAny;
};

export const getStakeForType = (distribution: TokenDistribution | undefined, type: StakeType) =>
  (distribution?.stakes || {})[type]?.value || 0;

export const onStakeCreated = async (transaction: ITransaction, stake: Stake) => {
  const distribution = await getTokenDistribution(transaction, stake.token, stake.member);
  if (stake.type === StakeType.DYNAMIC) {
    await updateMemberTokenDiscountPercentage(
      transaction,
      getProject(stake),
      distribution,
      stake.member,
      stake.value,
    );
  }
  updateStakingMembersStats(transaction, distribution, stake.token, stake.type, stake.value);
};

export const onStakeExpired = async (transaction: ITransaction, stake: Stake) => {
  const distribution = await getTokenDistribution(transaction, stake.token, stake.member);
  if (stake.type === StakeType.DYNAMIC) {
    await updateMemberTokenDiscountPercentage(
      transaction,
      getProject(stake),
      distribution,
      stake.member,
      -stake.value,
    );
    await removeMemberFromSpace(transaction, distribution, stake);
  }
  updateStakingMembersStats(transaction, distribution, stake.token, stake.type, -stake.value);
};

const getTokenDistribution = async (transaction: ITransaction, token: string, member: string) => {
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${token}`);
  const distirbutionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member);
  return await transaction.get<TokenDistribution>(distirbutionDocRef);
};

const updateMemberTokenDiscountPercentage = async (
  transaction: ITransaction,
  projectId: string,
  distribution: TokenDistribution | undefined,
  member: string,
  stakeValueDiff: number,
) => {
  const project = await build5Db().get<Project>(COL.PROJECT, projectId);
  const stakeValue = getStakeForType(distribution, StakeType.DYNAMIC) + stakeValueDiff;

  const tier = getTier(project?.config?.tiers || [], stakeValue);
  if (!tier && stakeValueDiff > 0) {
    return;
  }
  const discount = (project?.config?.tokenTradingFeeDiscountPercentage || [])[tier] / 100;
  const tokenTradingFeePercentage = getTokenSaleConfig.percentage * (1 - discount);

  const memberDocRef = build5Db().doc(`${COL.MEMBER}/${member}`);
  transaction.update(memberDocRef, { tokenTradingFeePercentage });
};

export const getTier = (tiers: number[], stakeValue: number) => {
  let tier = 1;
  while (stakeValue && tiers[tier] <= stakeValue && tier < tiers.length) {
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
  const tokenStatsDocRef = build5Db().doc(`${COL.TOKEN}/${token}/${SUB_COL.STATS}/${token}`);

  const prevStakedAmount = getStakeForType(distribution, type);
  if (!prevStakedAmount) {
    transaction.set(
      tokenStatsDocRef,
      { stakes: { [type]: { stakingMembersCount: build5Db().inc(1) } } },
      true,
    );
    return;
  }

  const currentStakedAmount = prevStakedAmount + stakeValueDiff;
  if (!currentStakedAmount) {
    transaction.set(
      tokenStatsDocRef,
      { stakes: { [type]: { stakingMembersCount: build5Db().inc(-1) } } },
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
  const spaceDocRef = build5Db().doc(`${COL.SPACE}/${stake.space}`);
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
    totalGuardians: build5Db().inc(isGuardian && space.totalGuardians > 1 ? -1 : 0),
    totalMembers: build5Db().inc(space.totalMembers > 1 ? -1 : 0),
  });
};
