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
  WEN_FUNC_TRIGGER,
} from '@build-5/interfaces';
import * as functions from 'firebase-functions/v2';
import { DocumentOptions } from 'firebase-functions/v2/firestore';
import bigDecimal from 'js-big-decimal';
import { scale } from '../../scale.settings';
import { getStakeForType, getTier } from '../../services/stake.service';
import { cancelTradeOrderUtil } from '../../utils/token-trade.utils';
import { BIG_DECIMAL_PRECISION } from '../../utils/token.utils';
import { matchTradeOrder } from './match-token';

const runParams = {
  document: `${COL.TOKEN_MARKET}/{tradeId}`,
  timeoutSeconds: 540,
  minInstances: scale(WEN_FUNC_TRIGGER.onTokenTradeOrderWrite),
} as DocumentOptions<string>;

export const onTokenTradeOrderWrite = functions.firestore.onDocumentWritten(
  runParams,
  async (event) => {
    const prev = <TokenTradeOrder | undefined>event.data?.before?.data();
    const next = <TokenTradeOrder | undefined>event.data?.after?.data();
    if (!next) {
      return;
    }

    if (!prev || (!prev.shouldRetry && next?.shouldRetry)) {
      return await matchTradeOrder(next);
    }

    return await build5Db().runTransaction(async (transaction) => {
      const tradeOrderDocRef = build5Db().doc(`${COL.TOKEN_MARKET}/${next.uid}`);
      const tradeOrder = await transaction.get<TokenTradeOrder>(tradeOrderDocRef);
      if (tradeOrder && isActiveBuy(tradeOrder) && needsHigherBuyAmount(tradeOrder!)) {
        await cancelTradeOrderUtil(
          transaction,
          tradeOrder,
          TokenTradeOrderStatus.CANCELLED_UNFULFILLABLE,
        );
      }
    });
  },
);

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
  const tokenDocRef = build5Db().doc(`${COL.TOKEN}/${project.config.baseTokenUid}`);
  const distributionDocRef = tokenDocRef.collection(SUB_COL.DISTRIBUTION).doc(member.uid);
  const distribution = await distributionDocRef.get<TokenDistribution>();
  const stakeValue = getStakeForType(distribution, StakeType.DYNAMIC);
  return getTier(project.config.tiers || [], stakeValue);
};

export const getTokenTradingFee = (member: Member) =>
  member.tokenTradingFeePercentage !== undefined ? member.tokenTradingFeePercentage : null;
