import { GetAvgPriceRequest, PublicCollections } from '@soonaverse/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { combineLatest, map } from 'rxjs';
import { soonDb } from '../firebase/firestore/soondb';
import { CommonJoi } from '../services/joi/common';
import { getHeadCountObs, getQueryParams } from './common';
import { sendLiveUpdates } from './keepAlive';

const getAvgPriceSchema = Joi.object({
  token: CommonJoi.uid(),
  sessionId: CommonJoi.sessionId(true),
});

export const getAvgPrice = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetAvgPriceRequest>(req, res, getAvgPriceSchema);
  if (!body) {
    return;
  }
  const result = getAvgLive(body.token).pipe(map((avg) => ({ id: body.token, avg })));
  await sendLiveUpdates(body.sessionId!, res, result);
};

const getAvgLive = (token: string) => {
  const lowestPurchaseObs = getHeadCountObs(purchaseQuery(token, true));
  const highestPurchaseObs = getHeadCountObs(purchaseQuery(token, false));
  const lastPurchaseObs = getHeadCountObs(purchaseQuery(token));
  return combineLatest([lowestPurchaseObs, highestPurchaseObs, lastPurchaseObs]).pipe(
    map(([lowest, highest, last]) => (highest + lowest + last) / 3),
  );
};

const purchaseQuery = (token: string, lowest?: boolean) => {
  if (lowest === undefined) {
    soonDb()
      .collection(PublicCollections.TOKEN_PURCHASE)
      .where('token', '==', token)
      .orderBy('createdOn', 'desc')
      .limit(1);
  }
  return soonDb()
    .collection(PublicCollections.TOKEN_PURCHASE)
    .where('token', '==', token)
    .where('in7d', '==', true)
    .orderBy('price', lowest ? 'asc' : 'desc')
    .limit(1);
};
