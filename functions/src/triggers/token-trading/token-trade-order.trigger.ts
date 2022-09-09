import * as functions from 'firebase-functions';
import bigDecimal from 'js-big-decimal';
import { WEN_FUNC } from '../../../interfaces/functions';
import { COL } from '../../../interfaces/models/base';
import { Token, TokenStatus, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from '../../../interfaces/models/token';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { cancelTradeOrderUtil } from '../../utils/token-trade.utils';
import { BIG_DECIMAL_PRECISION } from '../../utils/token.utils';
import { matchBaseToken } from './match-base-token';
import { matchMintedToken } from './match-minted-token';
import { matchSimpleToken } from './match-simple-token';

export const TOKEN_SALE_ORDER_FETCH_LIMIT = 20

export type StartAfter = admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>

const runParams = { timeoutSeconds: 540, memory: "512MB", minInstances: scale(WEN_FUNC.onTokenTradeOrderWrite) } as functions.RuntimeOptions

export const onTokenTradeOrderWrite = functions.runWith(runParams)
  .firestore.document(`${COL.TOKEN_MARKET}/{tradeId}`).onWrite(async (change) => {
    const prev = <TokenTradeOrder | undefined>change.before.data()
    const next = <TokenTradeOrder | undefined>change.after.data()
    if (!next) {
      return;
    }
    const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${next.token}`).get()).data()
    if (!prev || (!prev.shouldRetry && next?.shouldRetry)) {
      if (token.status === TokenStatus.BASE) {
        return await matchBaseToken(next.uid)
      }
      if (token.status === TokenStatus.MINTED) {
        return await matchMintedToken(next.uid)
      }
      return await matchSimpleToken(next.uid)
    }

    return await admin.firestore().runTransaction(async (transaction) => {
      const tradeOrderDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${next.uid}`)
      const tradeOrder = <TokenTradeOrder | undefined>(await transaction.get(tradeOrderDocRef)).data()
      if (tradeOrder && isActiveBuy(tradeOrder) && needsHigherBuyAmount(tradeOrder!)) {
        await cancelTradeOrderUtil(transaction, tradeOrder, TokenTradeOrderStatus.CANCELLED_UNFULFILLABLE)
      }
    })
  })

export const getSaleQuery = (trade: TokenTradeOrder, startAfter: StartAfter | undefined) => {
  let query = admin.firestore().collection(COL.TOKEN_MARKET)
    .where('type', '==', trade.type === TokenTradeOrderType.BUY ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY)
    .where('token', '==', trade.token)
    .where('price', trade.type === TokenTradeOrderType.BUY ? '<=' : '>=', trade.price)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .orderBy('price', trade.type === TokenTradeOrderType.BUY ? 'asc' : 'desc')
    .orderBy('createdOn')
    .limit(TOKEN_SALE_ORDER_FETCH_LIMIT)
  if (startAfter) {
    query = query.startAfter(startAfter)
  }
  return query
}

const isActiveBuy = (sale?: TokenTradeOrder) => sale?.type === TokenTradeOrderType.BUY && sale?.status === TokenTradeOrderStatus.ACTIVE

const needsHigherBuyAmount = (buy: TokenTradeOrder) => {
  const tokensLeft = Number(bigDecimal.subtract(buy.count, buy.fulfilled))
  const price = Number(bigDecimal.floor(bigDecimal.divide(buy.balance || 0, tokensLeft, BIG_DECIMAL_PRECISION)))
  return price > buy.price
}
