import {
  COL,
  Member,
  StakeType,
  SUB_COL,
  TokenDistribution,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
  WEN_FUNC,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import bigDecimal from 'js-big-decimal';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { getStakeForType, getTier } from '../../services/stake.service';
import { cancelTradeOrderUtil } from '../../utils/token-trade.utils';
import { BIG_DECIMAL_PRECISION, getSoonToken } from '../../utils/token.utils';
import { matchTradeOrder } from './match-token';

const runParams = {
  timeoutSeconds: 540,
  memory: '512MB',
  minInstances: scale(WEN_FUNC.onTokenTradeOrderWrite),
} as functions.RuntimeOptions;

export const onTokenTradeOrderWrite = functions
  .runWith(runParams)
  .firestore.document(`${COL.TOKEN_MARKET}/{tradeId}`)
  .onWrite(async (change) => {
    const prev = <TokenTradeOrder | undefined>change.before.data();
    const next = <TokenTradeOrder | undefined>change.after.data();
    if (!next) {
      return;
    }

    if (!prev || (!prev.shouldRetry && next?.shouldRetry)) {
      return await matchTradeOrder(next);
    }

    return await admin.firestore().runTransaction(async (transaction) => {
      const tradeOrderDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${next.uid}`);
      const tradeOrder = <TokenTradeOrder | undefined>(
        (await transaction.get(tradeOrderDocRef)).data()
      );
      if (tradeOrder && isActiveBuy(tradeOrder) && needsHigherBuyAmount(tradeOrder!)) {
        await cancelTradeOrderUtil(
          transaction,
          tradeOrder,
          TokenTradeOrderStatus.CANCELLED_UNFULFILLABLE,
        );
      }
    });
  });

const isActiveBuy = (sale?: TokenTradeOrder) =>
  sale?.type === TokenTradeOrderType.BUY && sale?.status === TokenTradeOrderStatus.ACTIVE;

const needsHigherBuyAmount = (buy: TokenTradeOrder) => {
  const tokensLeft = Number(bigDecimal.subtract(buy.count, buy.fulfilled));
  const price = Number(
    bigDecimal.floor(bigDecimal.divide(buy.balance || 0, tokensLeft, BIG_DECIMAL_PRECISION)),
  );
  return price > buy.price;
};

export const getMemberTier = async (member: Member) => {
  const soon = await getSoonToken();
  const distributionDocRef = admin
    .firestore()
    .collection(COL.TOKEN)
    .doc(soon.uid)
    .collection(SUB_COL.DISTRIBUTION)
    .doc(member.uid);
  const distribution = <TokenDistribution>(await distributionDocRef.get()).data();
  const stakeValue = getStakeForType(distribution, StakeType.DYNAMIC);
  return getTier(stakeValue);
};

export const getTokenTradingFee = (member: Member) =>
  member.tokenTradingFeePercentage !== undefined ? member.tokenTradingFeePercentage : null;
