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
} from '@soonaverse/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { head } from 'lodash';
import { soonDb } from '../firebase/firestore/soondb';
import { CommonJoi } from '../services/joi/common';
import { getQueryParams } from './common';

const getTokenPriceSchema = Joi.object({
  token: CommonJoi.uid(),
});

export const getTokenPrice = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetTokenPrice>(req, res, getTokenPriceSchema);
  if (!body) {
    return;
  }

  const lowestSellSnap = await soonDb()
    .collection(PublicCollections.TOKEN_MARKET)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .where('token', '==', body.token)
    .where('type', '==', TokenTradeOrderType.SELL)
    .orderBy('price')
    .limit(1)
    .get<TokenTradeOrder>();

  const highestBuySnap = await soonDb()
    .collection(PublicCollections.TOKEN_MARKET)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .where('token', '==', body.token)
    .where('type', '==', TokenTradeOrderType.BUY)
    .orderBy('price', 'desc')
    .limit(1)
    .get<TokenTradeOrder>();

  const lowestSell = head(lowestSellSnap)?.price || 0;
  const highestBuy = head(highestBuySnap)?.price || 0;
  const price = highestBuy && lowestSell ? (highestBuy + lowestSell) / 2 : 0;
  const usdPrice = await getUsdPrice(price / MIN_IOTA_AMOUNT);
  res.send({ id: body.token, price, usdPrice });
};

const getUsdPrice = async (priceInSmr: number) => {
  const tickerDocRef = soonDb().doc(`${COL.TICKER}/${TICKERS.SMRUSD}`);
  const ticker = <Ticker>await tickerDocRef.get();
  return Number((priceInSmr * ticker.price).toFixed(6));
};
