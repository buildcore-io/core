import * as functions from 'firebase-functions';
import { WEN_FUNC } from '../../../interfaces/functions';
import { COL } from '../../../interfaces/models/base';
import { Token, TokenStatus, TokenTradeOrder, TokenTradeOrderStatus, TokenTradeOrderType } from '../../../interfaces/models/token';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { matchBaseToken } from './match-base-token';
import { matchMintedToken } from './match-minted-token';
import { matchSimpleToken } from './match-simple-token';

export const TOKEN_SALE_ORDER_FETCH_LIMIT = 50

export type StartAfter = admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>

export const onTokenTradeOrderWrite = functions.runWith({ timeoutSeconds: 540, memory: "512MB", minInstances: scale(WEN_FUNC.onTokenBuySellCreated) })
  .firestore.document(COL.TOKEN_MARKET + '/{buySellId}').onWrite(async (snap, context) => {
    try {
      const id = context.params.buySellId
      const prev = <TokenTradeOrder | undefined>snap.before.data()
      const next = <TokenTradeOrder | undefined>snap.after.data()

      if (next?.sourceNetwork) {
        return await matchBaseToken(id, prev, next)
      }

      const token = <Token | undefined>(await admin.firestore().doc(`${COL.TOKEN}/${next?.token}`).get()).data()
      if (!token) {
        return;
      }
      if (token.status === TokenStatus.MINTED) {
        return await matchMintedToken(id, prev, next)
      }
      await matchSimpleToken(id, prev, next)
    } catch (error) {
      functions.logger.error(error)
      throw error
    }
  });

export const getSaleQuery = (sale: TokenTradeOrder, startAfter: StartAfter | undefined) => {
  let query = admin.firestore().collection(COL.TOKEN_MARKET)
    .where('type', '==', sale.type === TokenTradeOrderType.BUY ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY)
    .where('token', '==', sale.token)
    .where('price', sale.type === TokenTradeOrderType.BUY ? '<=' : '>=', sale.price)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .orderBy('price')
    .orderBy('createdOn')
    .limit(TOKEN_SALE_ORDER_FETCH_LIMIT)
  if (startAfter) {
    query = query.startAfter(startAfter)
  }
  return query
}
