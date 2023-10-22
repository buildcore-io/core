import { build5Db } from '@build-5/database';
import {
  COL,
  Member,
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
import { BIG_DECIMAL_PRECISION, getSoonToken } from '../../utils/token.utils';
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

export const getMemberTier = async (member: Member) => {
  const soon = await getSoonToken();
  const distributionDocRef = build5Db()
    .collection(COL.TOKEN)
    .doc(soon.uid)
    .collection(SUB_COL.DISTRIBUTION)
    .doc(member.uid);
  const distribution = await distributionDocRef.get<TokenDistribution>();
  const stakeValue = getStakeForType(distribution, StakeType.DYNAMIC);
  return getTier(stakeValue);
};

export const getTokenTradingFee = (member: Member) =>
  member.tokenTradingFeePercentage !== undefined ? member.tokenTradingFeePercentage : null;
