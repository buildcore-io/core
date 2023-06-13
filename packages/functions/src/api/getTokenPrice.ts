import {
  COL,
  GetTokenPrice,
  MIN_IOTA_AMOUNT,
  PublicCollections,
  Ticker,
  TICKERS,
  TokenTradeOrder,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@build-5/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { head } from 'lodash';
import { combineLatest, map } from 'rxjs';
import { build5Db } from '../firebase/firestore/build5Db';
import { CommonJoi } from '../services/joi/common';
import { documentToObservable, getQueryParams, queryToObservable } from './common';
import { sendLiveUpdates } from './keepAlive';

const getTokenPriceSchema = Joi.object({
  token: CommonJoi.uid(),
  sessionId: CommonJoi.sessionId(),
});

const tickerDocRef = build5Db().doc(`${COL.TICKER}/${TICKERS.SMRUSD}`);

export const getTokenPrice = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetTokenPrice>(req, res, getTokenPriceSchema);
  if (!body) {
    return;
  }

  const lowestSellQuery = build5Db()
    .collection(PublicCollections.TOKEN_MARKET)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .where('token', '==', body.token)
    .where('type', '==', TokenTradeOrderType.SELL)
    .orderBy('price')
    .limit(1);

  const highestBuyQuery = build5Db()
    .collection(PublicCollections.TOKEN_MARKET)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .where('token', '==', body.token)
    .where('type', '==', TokenTradeOrderType.BUY)
    .orderBy('price', 'desc')
    .limit(1);

  if (body.sessionId) {
    const lowestSell = queryToObservable<TokenTradeOrder>(lowestSellQuery);
    const highestBuy = queryToObservable<TokenTradeOrder>(highestBuyQuery);
    const ticker = documentToObservable<Ticker>(tickerDocRef);
    const combined = combineLatest([lowestSell, highestBuy, ticker]).pipe(
      map(([lowestSell, highestBuy, ticker]) => {
        const price = calculatePrice(lowestSell, highestBuy);
        return { id: body.token, price, usdPrice: toUsdPrice(price, ticker) };
      }),
    );
    await sendLiveUpdates(body.sessionId, res, combined);
    return;
  }

  const ticker = <Ticker>await tickerDocRef.get();
  const lowestSellSnap = await lowestSellQuery.get<TokenTradeOrder>();
  const highestBuySnap = await highestBuyQuery.get<TokenTradeOrder>();
  const price = calculatePrice(lowestSellSnap, highestBuySnap);
  res.send({ id: body.token, price, usdPrice: toUsdPrice(price, ticker) });
};

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
