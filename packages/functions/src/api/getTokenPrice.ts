import {
  GetTokenPrice,
  PublicCollections,
  TokenTradeOrderStatus,
  TokenTradeOrderType,
} from '@soon/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { head } from 'lodash';
import admin from '../admin.config';
import { CommonJoi } from '../services/joi/common';
import { assertValidation } from '../utils/schema.utils';

const getTokenPriceSchema = Joi.object({
  token: CommonJoi.uid(),
});

export const getTokenPrice = async (req: functions.https.Request, res: functions.Response) => {
  assertValidation(getTokenPriceSchema.validate(req.body));
  const body = <GetTokenPrice>req.body;

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
  res.send({ price });
};
