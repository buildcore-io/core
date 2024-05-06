import { IQuery, ITransaction, PgTokenMarket, database } from '@buildcore/database';
import {
  COL,
  Token,
  TokenPurchase,
  TokenStatus,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import bigDecimal from 'js-big-decimal';
import { cloneDeep } from 'lodash';
import { matchBaseToken } from './match-base-token';
import { matchMintedToken } from './match-minted-token';
import { matchSimpleToken, updateSellLockAndDistribution } from './match-simple-token';

export interface Match {
  readonly purchase: TokenPurchase | undefined;
  readonly sellerCreditId: string | undefined;
  readonly buyerCreditId: string | undefined;
}

type Query = (trade: TokenTradeOrder) => IQuery<TokenTradeOrder, PgTokenMarket>;
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
) => Promise<void>;

export const TOKEN_TRADE_ORDER_FETCH_LIMIT = 20;

export const matchTradeOrder = async (tradeOrder: PgTokenMarket) => {
  const token = (await database().doc(COL.TOKEN, tradeOrder.token!).get())!;

  const query = getQuery(token);
  const matcher = getMatcher(token);
  const postMatchActions = getPostMatchActions(token);

  await runTradeOrderMatching(query, matcher, postMatchActions, token, tradeOrder.uid);

  if (tradeOrder.type === TokenTradeOrderType.BUY) {
    await runTradeOrderMatching(query, matcher, postMatchActions, token, tradeOrder.uid, false);
  }
};

const runTradeOrderMatching = (
  query: Query,
  matcher: Matcher,
  postMatchActions: PostMatchAction | undefined,
  token: Token,
  tradeOrderId: string,
  invertedPrice = true,
) =>
  database().runTransaction(async (transaction) => {
    const tradeOrderDocRef = database().doc(COL.TOKEN_MARKET, tradeOrderId);
    const tradeOrder = (await transaction.get(tradeOrderDocRef))!;
    if (tradeOrder.status !== TokenTradeOrderStatus.ACTIVE) {
      return 0;
    }
    const docs = await query(tradeOrder).get();
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
      const docRef = database().doc(COL.TOKEN_MARKET, trade!.uid);
      await transaction.update(docRef, toPgTrade(isSell ? buy : sell));

      if (postMatchActions) {
        await postMatchActions(transaction, prevBuy, buy, prevSell, sell);
      }

      const purchaseDocRef = database().doc(COL.TOKEN_PURCHASE, purchase.uid);
      await transaction.create(purchaseDocRef, purchase);
      update = isSell ? sell : buy;
    }
    await transaction.update(database().doc(COL.TOKEN_MARKET, tradeOrder.uid), toPgTrade(update));
    return update.status === TokenTradeOrderStatus.SETTLED ? 0 : docs.length;
  });

const toPgTrade = (trade: TokenTradeOrder): PgTokenMarket => ({
  ...trade,
  createdOn: trade.createdOn?.toDate(),
  updatedOn: trade.updatedOn?.toDate(),
  tokenStatus: trade.tokenStatus,
  type: trade.type,
  status: trade.status,
  expiresAt: trade.expiresAt.toDate(),
  sourceNetwork: trade.sourceNetwork,
  targetNetwork: trade.targetNetwork,
});

const updateTrade = (trade: TokenTradeOrder, purchase: TokenPurchase, creditTransactionId = '') => {
  const fulfilled = trade.fulfilled + purchase.count;
  const salePrice = bigDecimal.floor(bigDecimal.multiply(purchase.count, purchase.price));
  const balance =
    trade.balance - (trade.type === TokenTradeOrderType.SELL ? purchase.count : salePrice);
  const status =
    trade.count === fulfilled || !balance
      ? TokenTradeOrderStatus.SETTLED
      : TokenTradeOrderStatus.ACTIVE;
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

const getSimpleTokenQuery = (trade: TokenTradeOrder) => {
  const type =
    trade.type === TokenTradeOrderType.BUY ? TokenTradeOrderType.SELL : TokenTradeOrderType.BUY;
  return database()
    .collection(COL.TOKEN_MARKET)
    .where('type', '==', type)
    .where('token', '==', trade.token)
    .where('price', trade.type === TokenTradeOrderType.BUY ? '<=' : '>=', trade.price)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .orderBy('price', trade.type === TokenTradeOrderType.BUY ? 'asc' : 'desc')
    .orderBy('createdOn');
};

const getBaseTokenTradeQuery = (trade: TokenTradeOrder) =>
  database()
    .collection(COL.TOKEN_MARKET)
    .where('sourceNetwork', '==', trade.targetNetwork)
    .where('token', '==', trade.token)
    .where('price', trade.type === TokenTradeOrderType.BUY ? '<=' : '>=', trade.price)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .orderBy('price', trade.type === TokenTradeOrderType.BUY ? 'asc' : 'desc')
    .orderBy('createdOn');

const getTradesSorted = async (transaction: ITransaction, unsortedTrades: TokenTradeOrder[]) => {
  const unsortedTradesDocs = unsortedTrades.map((ut) => database().doc(COL.TOKEN_MARKET, ut.uid));
  const trades = await transaction.getAll(...unsortedTradesDocs);
  return trades.sort((a, b) => {
    const price = a?.type === TokenTradeOrderType.SELL ? a.price - b!.price : b!.price - a!.price;
    const createdOn = dayjs(a!.createdOn?.toDate()).isBefore(dayjs(b!.createdOn?.toDate()))
      ? -1
      : 1;
    return price || createdOn;
  });
};
