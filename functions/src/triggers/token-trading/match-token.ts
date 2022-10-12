import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { cloneDeep, isEmpty, last } from 'lodash';
import {
  Token,
  TokenPurchase,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '../../../interfaces/models';
import { COL } from '../../../interfaces/models/base';
import admin from '../../admin.config';
import { LastDocType } from '../../utils/common.utils';
import { uOn } from '../../utils/dateTime.utils';
import { matchBaseToken } from './match-base-token';
import { matchMintedToken } from './match-minted-token';
import { matchSimpleToken, updateSellLockAndDistribution } from './match-simple-token';

export interface Match {
  readonly purchase: TokenPurchase | undefined;
  readonly sellerCreditId: string | undefined;
  readonly buyerCreditId: string | undefined;
}

type Query = (
  trade: TokenTradeOrder,
  startAfter: LastDocType | undefined,
) => admin.firestore.Query<admin.firestore.DocumentData>;
type Matcher = (
  transaction: admin.firestore.Transaction,
  token: Token,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  price: number,
  triggeredBy: TokenTradeOrderType,
) => Promise<Match>;
type PostMatchAction = (
  transaction: admin.firestore.Transaction,
  prevBuy: TokenTradeOrder,
  buy: TokenTradeOrder,
  prevSell: TokenTradeOrder,
  sell: TokenTradeOrder,
) => void;

export const TOKEN_TRADE_ORDER_FETCH_LIMIT = 20;

export const matchTradeOrder = async (tradeOrder: TokenTradeOrder) => {
  const token = <Token>(
    (await admin.firestore().doc(`${COL.TOKEN}/${tradeOrder.token}`).get()).data()
  );

  const query = getQuery(token);
  const matcher = getMatcher(token);
  const postMatchActions = getPostMatchActions(token);

  let lastDoc: LastDocType | undefined = undefined;
  do {
    lastDoc = await runTradeOrderMatching(
      query,
      matcher,
      postMatchActions,
      lastDoc,
      token,
      tradeOrder.uid,
    );
  } while (lastDoc);

  if (tradeOrder.type === TokenTradeOrderType.BUY) {
    do {
      lastDoc = await runTradeOrderMatching(
        query,
        matcher,
        postMatchActions,
        lastDoc,
        token,
        tradeOrder.uid,
        false,
      );
    } while (lastDoc);
  }
};

const runTradeOrderMatching = async (
  query: Query,
  matcher: Matcher,
  postMatchActions: PostMatchAction | undefined,
  lastDoc: LastDocType | undefined,
  token: Token,
  tradeOrderId: string,
  invertedPrice = true,
) =>
  admin.firestore().runTransaction(async (transaction) => {
    const tradeOrderDocRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrderId}`);
    const tradeOrder = <TokenTradeOrder>(await transaction.get(tradeOrderDocRef)).data();
    if (tradeOrder.status !== TokenTradeOrderStatus.ACTIVE) {
      return;
    }
    const docs = (await query(tradeOrder, lastDoc).get()).docs;
    const trades = await getTradesSorted(transaction, docs);

    let update = cloneDeep(tradeOrder);
    for (const trade of trades) {
      const isSell = tradeOrder.type === TokenTradeOrderType.SELL;
      const prevBuy = isSell ? trade : update;
      const prevSell = isSell ? update : trade;
      if ([prevBuy.status, prevSell.status].includes(TokenTradeOrderStatus.SETTLED)) {
        continue;
      }

      const price = invertedPrice
        ? isSell
          ? prevBuy.price
          : prevSell.price
        : isSell
        ? prevSell.price
        : prevBuy.price;
      const triggeredBy = isSell ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY;
      const { purchase, buyerCreditId } = await matcher(
        transaction,
        token,
        prevBuy,
        prevSell,
        price,
        triggeredBy,
      );
      if (!purchase) {
        continue;
      }
      const sell = updateTrade(prevSell, purchase);
      const buy = updateTrade(prevBuy, purchase, buyerCreditId);
      const docRef = admin.firestore().doc(`${COL.TOKEN_MARKET}/${trade.uid}`);
      transaction.update(docRef, uOn(isSell ? buy : sell));

      if (postMatchActions) {
        postMatchActions(transaction, prevBuy, buy, prevSell, sell);
      }

      transaction.create(admin.firestore().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`), purchase);
      update = isSell ? sell : buy;
    }
    transaction.update(admin.firestore().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`), uOn(update));
    return update.status === TokenTradeOrderStatus.SETTLED ? undefined : last(docs);
  });

const updateTrade = (trade: TokenTradeOrder, purchase: TokenPurchase, creditTransactionId = '') => {
  const fulfilled = trade.fulfilled + purchase.count;
  const salePrice = bigDecimal.floor(bigDecimal.multiply(purchase.count, purchase.price));
  const balance =
    trade.balance - (trade.type === TokenTradeOrderType.SELL ? purchase.count : salePrice);
  const status =
    trade.count === fulfilled ? TokenTradeOrderStatus.SETTLED : TokenTradeOrderStatus.ACTIVE;
  return { ...trade, fulfilled, balance, status, creditTransactionId };
};

const getQuery = (token: Token) => {
  if (token.status === TokenStatus.BASE) {
    return getBaseTokenTradeQuery;
  }
  return getSimpleTokenQuery;
};

const getMatcher = (token: Token) => {
  switch (token.status) {
    case TokenStatus.BASE:
      return matchBaseToken;
    case TokenStatus.MINTED:
      return matchMintedToken;
    default:
      return matchSimpleToken;
  }
};

const getPostMatchActions = (token: Token) => {
  switch (token.status) {
    case TokenStatus.BASE:
      return undefined;
    case TokenStatus.MINTED:
      return undefined;
    default:
      return updateSellLockAndDistribution;
  }
};

const getSimpleTokenQuery = (trade: TokenTradeOrder, startAfter: LastDocType | undefined) => {
  let query = admin
    .firestore()
    .collection(COL.TOKEN_MARKET)
    .where(
      'type',
      '==',
      trade.type === TokenTradeOrderType.BUY ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY,
    )
    .where('token', '==', trade.token)
    .where('price', trade.type === TokenTradeOrderType.BUY ? '<=' : '>=', trade.price)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .orderBy('price', trade.type === TokenTradeOrderType.BUY ? 'asc' : 'desc')
    .orderBy('createdOn')
    .limit(TOKEN_TRADE_ORDER_FETCH_LIMIT);
  if (startAfter) {
    query = query.startAfter(startAfter);
  }
  return query;
};

const getBaseTokenTradeQuery = (trade: TokenTradeOrder, startAfter: LastDocType | undefined) => {
  let query = admin
    .firestore()
    .collection(COL.TOKEN_MARKET)
    .where('sourceNetwork', '==', trade.targetNetwork)
    .where('token', '==', trade.token)
    .where('price', trade.type === TokenTradeOrderType.BUY ? '<=' : '>=', trade.price)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .orderBy('price', trade.type === TokenTradeOrderType.BUY ? 'asc' : 'desc')
    .orderBy('createdOn')
    .limit(TOKEN_TRADE_ORDER_FETCH_LIMIT);
  if (startAfter) {
    query = query.startAfter(startAfter);
  }
  return query;
};

const getTradesSorted = async (
  transaction: admin.firestore.Transaction,
  docs: admin.firestore.QueryDocumentSnapshot<admin.firestore.DocumentData>[],
) => {
  const trades = isEmpty(docs)
    ? []
    : (await transaction.getAll(...docs.map((d) => d.ref))).map((d) => <TokenTradeOrder>d.data());
  return trades.sort((a, b) => {
    const price = a.type === TokenTradeOrderType.SELL ? a.price - b.price : b.price - a.price;
    const createdOn = dayjs(a.createdOn?.toDate()).isBefore(dayjs(b.createdOn?.toDate())) ? -1 : 1;
    return price || createdOn;
  });
};
