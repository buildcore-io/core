import { database, PgTokenMarket } from '@buildcore/database';
import { COL, Member, ProjectBilling, StakeType, SUB_COL } from '@buildcore/interfaces';
import { getStakeForType, getTier } from '../../services/stake.service';
import { PgDocEvent } from '../common';
import { matchTradeOrder } from './match-token';

export const onTokenTradeOrderWrite = async (event: PgDocEvent<PgTokenMarket>) => {
  const { prev, curr } = event;
  if (!curr) {
    return;
  }

  if (!prev || (!prev.shouldRetry && curr?.shouldRetry)) {
    return await matchTradeOrder(curr);
  }
};

export const getMemberTier = async (projectId: string, member: Member) => {
  const project = await database().doc(COL.PROJECT, projectId).get();
  if (project?.config?.billing !== ProjectBilling.TOKEN_BASED) {
    return 0;
  }
  const distributionDocRef = database().doc(
    COL.TOKEN,
    project.config.nativeTokenUid!,
    SUB_COL.DISTRIBUTION,
    member.uid,
  );
  const distribution = await distributionDocRef.get();
  const stakeValue = getStakeForType(distribution, StakeType.DYNAMIC);
  return getTier(project.config.tiers || [], stakeValue);
};

export const getTokenTradingFee = (member: Member) =>
  member.tokenTradingFeePercentage !== undefined ? member.tokenTradingFeePercentage : null;
