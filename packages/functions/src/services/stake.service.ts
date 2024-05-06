import { database, ITransaction } from '@buildcore/database';
import {
  COL,
  ProjectBilling,
  Stake,
  StakeType,
  SUB_COL,
  TokenDistribution,
} from '@buildcore/interfaces';
import { getProject } from '../utils/common.utils';
import { getTokenSaleConfig } from '../utils/config.utils';

export const hasStakedTokens = async (projectId: string, member: string, type?: StakeType) => {
  const projectDocRef = database().doc(COL.PROJECT, projectId);
  const project = (await projectDocRef.get())!;
  if (project.config?.billing !== ProjectBilling.TOKEN_BASED) {
    return true;
  }
  const distributionDocRef = database().doc(
    COL.TOKEN,
    project.config.nativeTokenUid!,
    SUB_COL.DISTRIBUTION,
    member,
  );
  const distribution = await distributionDocRef.get();

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
  await updateStakingMembersStats(transaction, distribution, stake.token, stake.type, stake.value);
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
  await updateStakingMembersStats(transaction, distribution, stake.token, stake.type, -stake.value);
};

const getTokenDistribution = async (transaction: ITransaction, token: string, member: string) => {
  const distirbutionDocRef = database().doc(COL.TOKEN, token, SUB_COL.DISTRIBUTION, member);
  return await transaction.get(distirbutionDocRef);
};

const updateMemberTokenDiscountPercentage = async (
  transaction: ITransaction,
  projectId: string,
  distribution: TokenDistribution | undefined,
  member: string,
  stakeValueDiff: number,
) => {
  const projectDocRef = database().doc(COL.PROJECT, projectId);
  const project = await projectDocRef.get();
  const stakeValue = getStakeForType(distribution, StakeType.DYNAMIC) + stakeValueDiff;

  const tier = getTier(project?.config?.tiers || [], stakeValue);
  if (!tier && stakeValueDiff > 0) {
    return;
  }
  const discount = (project?.config?.tokenTradingFeeDiscountPercentage || [])[tier] / 100;
  const tokenTradingFeePercentage = getTokenSaleConfig.percentage * (1 - discount);

  const memberDocRef = database().doc(COL.MEMBER, member);
  await transaction.update(memberDocRef, { tokenTradingFeePercentage });
};

export const getTier = (tiers: number[], stakeValue: number) => {
  let tier = 1;
  while (stakeValue && tiers[tier] <= stakeValue && tier < tiers.length) {
    ++tier;
  }
  return tier - 1;
};

const updateStakingMembersStats = async (
  transaction: ITransaction,
  distribution: TokenDistribution | undefined,
  token: string,
  type: StakeType,
  stakeValueDiff: number,
) => {
  const tokenStatsDocRef = database().doc(COL.TOKEN, token, SUB_COL.STATS, token);

  const prevStakedAmount = getStakeForType(distribution, type);
  if (!prevStakedAmount) {
    await transaction.upsert(tokenStatsDocRef, {
      [`stakes_${type}_stakingMembersCount`]: database().inc(1),
    });
    return;
  }

  const currentStakedAmount = prevStakedAmount + stakeValueDiff;
  if (!currentStakedAmount) {
    await transaction.upsert(tokenStatsDocRef, {
      [`stakes_${type}_stakingMembersCount`]: database().inc(-1),
    });
    return;
  }
};

const removeMemberFromSpace = async (
  transaction: ITransaction,
  distribution: TokenDistribution | undefined,
  stake: Stake,
) => {
  const spaceDocRef = database().doc(COL.SPACE, stake.space);
  const space = (await spaceDocRef.get())!;
  const stakedValue = getStakeForType(distribution, stake.type) - stake.value;
  if (!space.tokenBased || stakedValue >= (space.minStakedValue || 0)) {
    return;
  }

  const guardianDocRef = database().doc(COL.SPACE, stake.space, SUB_COL.GUARDIANS, stake.member);
  const isGuardian = (await spaceDocRef.get()) !== undefined;
  if (isGuardian && space.totalGuardians > 1) {
    await transaction.delete(guardianDocRef);
  }
  if (space.totalMembers > 1) {
    const memberDocRef = database().doc(COL.SPACE, stake.space, SUB_COL.MEMBERS, stake.member);
    await transaction.delete(memberDocRef);
  }
  await transaction.update(spaceDocRef, {
    totalGuardians: database().inc(isGuardian && space.totalGuardians > 1 ? -1 : 0),
    totalMembers: database().inc(space.totalMembers > 1 ? -1 : 0),
  });
};
