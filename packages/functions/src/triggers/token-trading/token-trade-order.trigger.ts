import { build5Db } from '@build-5/database';
import {
  COL,
  Member,
  Project,
  ProjectBilling,
  StakeType,
  SUB_COL,
  TokenDistribution,
  TokenTradeOrder,
} from '@build-5/interfaces';
import { getStakeForType, getTier } from '../../services/stake.service';
import { FirestoreDocEvent } from '../common';
import { matchTradeOrder } from './match-token';

export const onTokenTradeOrderWrite = async (event: FirestoreDocEvent<TokenTradeOrder>) => {
  const { prev, curr } = event;
  if (!curr) {
    return;
  }

  if (!prev || (!prev.shouldRetry && curr?.shouldRetry)) {
    return await matchTradeOrder(curr);
  }
};

export const getMemberTier = async (projectId: string, member: Member) => {
  const project = await build5Db().get<Project>(COL.PROJECT, projectId);
  if (project?.config?.billing !== ProjectBilling.TOKEN_BASE) {
    return 0;
  }
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${project.config.nativeTokenUid}`);
  const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member.uid);
  const distribution = await distributionDocRef.get<TokenDistribution>();
  const stakeValue = getStakeForType(distribution, StakeType.DYNAMIC);
  return getTier(project.config.tiers || [], stakeValue);
};

export const getTokenTradingFee = (member: Member) =>
  member.tokenTradingFeePercentage !== undefined ? member.tokenTradingFeePercentage : null;
