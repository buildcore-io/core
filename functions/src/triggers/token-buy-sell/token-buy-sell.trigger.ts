import * as functions from 'firebase-functions';
import { WEN_FUNC } from '../../../interfaces/functions';
import { COL } from '../../../interfaces/models/base';
import { Token, TokenBuySellOrder, TokenBuySellOrderStatus, TokenBuySellOrderType, TokenStatus } from '../../../interfaces/models/token';
import admin from '../../admin.config';
import { scale } from '../../scale.settings';
import { matchMintedToken } from './match-minted-token';
import { matchSimpleToken } from './match-simple-token';

export const TOKEN_SALE_ORDER_FETCH_LIMIT = 50

export type StartAfter = admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>

export const onTokenBuySellWrite = functions.runWith({ timeoutSeconds: 540, memory: "512MB", minInstances: scale(WEN_FUNC.onTokenBuySellCreated) })
  .firestore.document(COL.TOKEN_MARKET + '/{buySellId}').onWrite(async (snap, context) => {
    try {
      const id = context.params.buySellId
      const prev = <TokenBuySellOrder | undefined>snap.before.data()
      const next = <TokenBuySellOrder | undefined>snap.after.data()
      const token = <Token>(await admin.firestore().doc(`${COL.TOKEN}/${next?.token}`).get()).data()
      if (token.status === TokenStatus.MINTED) {
        await matchMintedToken(id, prev, next)
      } else {
        await matchSimpleToken(id, prev, next)
      }
    } catch (error) {
      functions.logger.error(error)
      throw error
    }
  });

export const getSaleQuery = (sale: TokenBuySellOrder, startAfter: StartAfter | undefined) => {
  let query = admin.firestore().collection(COL.TOKEN_MARKET)
    .where('type', '==', sale.type === TokenBuySellOrderType.BUY ? TokenBuySellOrderType.SELL : TokenBuySellOrderType.BUY)
    .where('token', '==', sale.token)
    .where('price', sale.type === TokenBuySellOrderType.BUY ? '<=' : '>=', sale.price)
    .where('status', '==', TokenBuySellOrderStatus.ACTIVE)
    .orderBy('price')
    .orderBy('createdOn')
    .limit(TOKEN_SALE_ORDER_FETCH_LIMIT)
  if (startAfter) {
    query = query.startAfter(startAfter)
  }
  return query
}
