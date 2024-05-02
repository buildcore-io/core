import { build5Db } from '@build-5/database';
import {
  COL,
  GetTokenPrice,
  MIN_IOTA_AMOUNT,
  QUERY_MAX_LENGTH,
  QUERY_MIN_LENGTH,
  TICKERS,
  Ticker,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@build-5/interfaces';
import Joi from 'joi';
import { head } from 'lodash';
import { Observable, combineLatest, map } from 'rxjs';
import { CommonJoi, documentToObservable, getQueryParams, queryToObservable } from './common';

const getTokenPriceSchema = Joi.object({
  token: Joi.alternatives()
    .try(
      CommonJoi.uid(),
      Joi.array().min(QUERY_MIN_LENGTH).max(QUERY_MAX_LENGTH).items(CommonJoi.uid()),
    )
    .required(),
});

const tickerDocRef = build5Db().doc(COL.TICKER, TICKERS.SMRUSD);

export const getTokenPrice = async (url: string, isLive: boolean) => {
  const body = getQueryParams<GetTokenPrice>(url, getTokenPriceSchema);

  const ticker = documentToObservable(tickerDocRef, isLive);
  const tokens = Array.isArray(body.token) ? body.token : [body.token];
  const observables = tokens.map((token) => getPriceForTokenLive(token, ticker, isLive));
  const combined = combineLatest(observables).pipe(
    map((result) => (result.length === 1 ? result[0] : result)),
  );

  return combined;
};

const getPriceForTokenLive = (token: string, ticker: Observable<Ticker>, isLive: boolean) => {
  const lowestSell = queryToObservable<TokenTradeOrder>(lowestSellQuery(token), isLive);
  const highestBuy = queryToObservable<TokenTradeOrder>(highestBuyQuery(token), isLive);
  const combined = combineLatest([lowestSell, highestBuy, ticker]).pipe(
    map(([lowestSell, highestBuy, ticker]) => {
      const price = calculatePrice(lowestSell, highestBuy);
      return { id: token, price, usdPrice: toUsdPrice(price, ticker) };
    }),
  );
  return combined;
};

const lowestSellQuery = (token: string) =>
  build5Db()
    .collection(COL.TOKEN_MARKET)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .where('token', '==', token)
    .where('type', '==', TokenTradeOrderType.SELL)
    .orderBy('price')
    .limit(1);

const highestBuyQuery = (token: string) =>
  build5Db()
    .collection(COL.TOKEN_MARKET)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .where('token', '==', token)
    .where('type', '==', TokenTradeOrderType.BUY)
    .orderBy('price', 'desc')
    .limit(1);

const calculatePrice = (
  lowestSellOrders: TokenTradeOrder[],
  highestBuyOrders: TokenTradeOrder[],
) => {
  const lowestSell = head(lowestSellOrders)?.price || 0;
  const highestBuy = head(highestBuyOrders)?.price || 0;
  return highestBuy && lowestSell ? (highestBuy + lowestSell) / 2 : 0;
};

const toUsdPrice = (price: number, ticker: Ticker) =>
  Number(((price / MIN_IOTA_AMOUNT) * ticker.price).toFixed(6));
