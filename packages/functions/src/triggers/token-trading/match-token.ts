import {
  COL,
  Token,
  TokenPurchase,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@soonaverse/interfaces';
import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { cloneDeep, last } from 'lodash';
import { IQuery, ITransaction } from '../../firebase/firestore/interfaces';
import { getSnapshot, soonDb } from '../../firebase/firestore/soondb';
import { matchBaseToken } from './match-base-token';
import { matchMintedToken } from './match-minted-token';
import { matchSimpleToken, updateSellLockAndDistribution } from './match-simple-token';

export interface Match {
  readonly purchase: TokenPurchase | undefined;
  readonly sellerCreditId: string | undefined;
  readonly buyerCreditId: string | undefined;
}

type Query = (trade: TokenTradeOrder, startAfter: string) => Promise<IQuery>;
type Matcher = (
  transaction: ITransaction,
  token: Token,
  buy: TokenTradeOrder,
  sell: TokenTradeOrder,
  price: number,
  triggeredBy: TokenTradeOrderType,
) => Promise<Match>;
type PostMatchAction = (
  transaction: ITransaction,
  prevBuy: TokenTradeOrder,
  buy: TokenTradeOrder,
  prevSell: TokenTradeOrder,
  sell: TokenTradeOrder,
) => void;

export const TOKEN_TRADE_ORDER_FETCH_LIMIT = 20;

export const matchTradeOrder = async (tradeOrder: TokenTradeOrder) => {
  const token = (await soonDb().doc(`${COL.TOKEN}/${tradeOrder.token}`).get<Token>())!;

  const query = getQuery(token);
  const matcher = getMatcher(token);
  const postMatchActions = getPostMatchActions(token);

  let lastDocId = '';
  do {
    lastDocId = await runTradeOrderMatching(
      query,
      matcher,
      postMatchActions,
      lastDocId,
      token,
      tradeOrder.uid,
    );
  } while (lastDocId);

  if (tradeOrder.type === TokenTradeOrderType.BUY) {
    do {
      lastDocId = await runTradeOrderMatching(
        query,
        matcher,
        postMatchActions,
        lastDocId,
        token,
        tradeOrder.uid,
        false,
      );
    } while (lastDocId);
  }
};

const runTradeOrderMatching = async (
  query: Query,
  matcher: Matcher,
  postMatchActions: PostMatchAction | undefined,
  lastDocId: string,
  token: Token,
  tradeOrderId: string,
  invertedPrice = true,
) =>
  soonDb().runTransaction(async (transaction) => {
    const tradeOrderDocRef = soonDb().doc(`${COL.TOKEN_MARKET}/${tradeOrderId}`);
    const tradeOrder = (await transaction.get<TokenTradeOrder>(tradeOrderDocRef))!;
    if (tradeOrder.status !== TokenTradeOrderStatus.ACTIVE) {
      return '';
    }
    const docs = await (await query(tradeOrder, lastDocId)).get<TokenTradeOrder>();
    const trades = await getTradesSorted(transaction, docs);

    let update = cloneDeep(tradeOrder);
    for (const trade of trades) {
      const isSell = tradeOrder.type === TokenTradeOrderType.SELL;
      const prevBuy = isSell ? trade! : update;
      const prevSell = isSell ? update : trade!;
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
      const docRef = soonDb().doc(`${COL.TOKEN_MARKET}/${trade!.uid}`);
      transaction.update(docRef, isSell ? buy : sell);

      if (postMatchActions) {
        postMatchActions(transaction, prevBuy, buy, prevSell, sell);
      }

      transaction.create(soonDb().doc(`${COL.TOKEN_PURCHASE}/${purchase.uid}`), purchase);
      update = isSell ? sell : buy;
    }
    transaction.update(soonDb().doc(`${COL.TOKEN_MARKET}/${tradeOrder.uid}`), update);
    return update.status === TokenTradeOrderStatus.SETTLED ? '' : last(docs)?.uid || '';
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

const getSimpleTokenQuery = async (trade: TokenTradeOrder, startAfter = '') => {
  const lastDoc = await getSnapshot(COL.TOKEN_MARKET, startAfter);
  return soonDb()
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
    .startAfter(lastDoc)
    .limit(TOKEN_TRADE_ORDER_FETCH_LIMIT);
};

const getBaseTokenTradeQuery = async (trade: TokenTradeOrder, startAfter = '') => {
  const lastDoc = await getSnapshot(COL.TOKEN_MARKET, startAfter);
  return soonDb()
    .collection(COL.TOKEN_MARKET)
    .where('sourceNetwork', '==', trade.targetNetwork)
    .where('token', '==', trade.token)
    .where('price', trade.type === TokenTradeOrderType.BUY ? '<=' : '>=', trade.price)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .orderBy('price', trade.type === TokenTradeOrderType.BUY ? 'asc' : 'desc')
    .orderBy('createdOn')
    .startAfter(lastDoc)
    .limit(TOKEN_TRADE_ORDER_FETCH_LIMIT);
};

const getTradesSorted = async (transaction: ITransaction, unsortedTrades: TokenTradeOrder[]) => {
  const unsortedTradesDocs = unsortedTrades.map((ut) =>
    soonDb().doc(`${COL.TOKEN_MARKET}/${ut.uid}`),
  );
  const trades = await transaction.getAll<TokenTradeOrder>(...unsortedTradesDocs);
  return trades.sort((a, b) => {
    const price = a?.type === TokenTradeOrderType.SELL ? a.price - b!.price : b!.price - a!.price;
    const createdOn = dayjs(a!.createdOn?.toDate()).isBefore(dayjs(b!.createdOn?.toDate()))
      ? -1
      : 1;
    return price || createdOn;
  });
};
