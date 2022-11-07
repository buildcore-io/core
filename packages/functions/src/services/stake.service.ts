import {
  COL,
  Stake,
  StakeType,
  SUB_COL,
  tiers,
  TokenDistribution,
  tokenTradingFeeDicountPercentage,
} from '@soonaverse/interfaces';
import admin from '../admin.config';
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
    (acc, act) => acc || getStakeForType(distribution, act) > 0,
    false,
  );
  return hasAny;
};

const getStakeForType = (distribution: TokenDistribution | undefined, type: StakeType) =>
  (distribution?.stakes || {})[type]?.value || 0;

export const onStakeCreated = async (transaction: admin.firestore.Transaction, stake: Stake) => {
  await updateMemberTokenDiscountPercentage(transaction, stake.token, stake.member, stake.value);
};

export const onStakeExpired = async (transaction: admin.firestore.Transaction, stake: Stake) => {
  await updateMemberTokenDiscountPercentage(transaction, stake.token, stake.member, -stake.value);
};

const updateMemberTokenDiscountPercentage = async (
  transaction: admin.firestore.Transaction,
  token: string,
  member: string,
  stakeValueDiff: number,
) => {
  const distirbutionDocRef = admin
    .firestore()
    .doc(`${COL.TOKEN}/${token}/${SUB_COL.DISTRIBUTION}/${member}`);
  const distribution = <TokenDistribution | undefined>(
    (await transaction.get(distirbutionDocRef)).data()
  );
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

const getTier = (stakeValue: number) => {
  let tier = 0;
  while (tiers[tier] <= stakeValue && tier < tiers.length) {
    ++tier;
  }
  return tier - 1;
};
