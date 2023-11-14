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
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@build-5/interfaces';
import bigDecimal from 'js-big-decimal';
import { getStakeForType, getTier } from '../../services/stake.service';
import { cancelTradeOrderUtil } from '../../utils/token-trade.utils';
import { BIG_DECIMAL_PRECISION } from '../../utils/token.utils';
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

  return await build5Db().runTransaction(async (transaction) => {
    const tradeOrderDocRef = build5Db().doc(`${COL.TOKEN_MARKET}/${curr.uid}`);
    const tradeOrder = await transaction.get<TokenTradeOrder>(tradeOrderDocRef);
    if (tradeOrder && isActiveBuy(tradeOrder) && needsHigherBuyAmount(tradeOrder!)) {
      await cancelTradeOrderUtil(
        transaction,
        tradeOrder,
        TokenTradeOrderStatus.CANCELLED_UNFULFILLABLE,
      );
    }
  });
};

const isActiveBuy = (sale?: TokenTradeOrder) =>
  sale?.type === TokenTradeOrderType.BUY && sale?.status === TokenTradeOrderStatus.ACTIVE;

const needsHigherBuyAmount = (buy: TokenTradeOrder) => {
  const tokensLeft = Number(bigDecimal.subtract(buy.count, buy.fulfilled));
  const price = Number(
    bigDecimal.floor(bigDecimal.divide(buy.balance || 0, tokensLeft, BIG_DECIMAL_PRECISION)),
  );
  return price > buy.price;
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
