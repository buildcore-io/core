import {
  COL,
  GetTokenPrice,
  MIN_IOTA_AMOUNT,
  PublicCollections,
  Ticker,
  TICKERS,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { head } from 'lodash';
import admin from '../admin.config';
import { CommonJoi } from '../services/joi/common';
import { getQueryParams } from './common';

const getTokenPriceSchema = Joi.object({
  token: CommonJoi.uid(),
});

export const getTokenPrice = async (req: functions.https.Request, res: functions.Response) => {
  const body = getQueryParams<GetTokenPrice>(req, res, getTokenPriceSchema);
  if (!body) {
    return;
  }

  const lowestSellSnap = await admin
    .firestore()
    .collection(PublicCollections.TOKEN_MARKET)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .where('token', '==', body.token)
    .where('type', '==', TokenTradeOrderType.SELL)
    .orderBy('price')
    .limit(1)
    .get();

  const highestBuySnap = await admin
    .firestore()
    .collection(PublicCollections.TOKEN_MARKET)
    .where('status', '==', TokenTradeOrderStatus.ACTIVE)
    .where('token', '==', body.token)
    .where('type', '==', TokenTradeOrderType.BUY)
    .orderBy('price', 'desc')
    .limit(1)
    .get();

  const lowestSell = head(lowestSellSnap.docs)?.data()?.price || 0;
  const highestBuy = head(highestBuySnap.docs)?.data()?.price || 0;
  const price = highestBuy && lowestSell ? (highestBuy + lowestSell) / 2 : 0;
  const usdPrice = await getUsdPrice(price / MIN_IOTA_AMOUNT);
  res.send({ id: body.token, price, usdPrice });
};

const getUsdPrice = async (priceInSmr: number) => {
  const tickerDocRef = admin.firestore().doc(`${COL.TICKER}/${TICKERS.SMRUSD}`);
  const ticker = <Ticker>(await tickerDocRef.get()).data();
  return Number((priceInSmr * ticker.price).toFixed(6));
};
