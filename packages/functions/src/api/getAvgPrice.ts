import {
  GetAvgPriceRequest,
  PublicCollections,
  QUERY_MAX_LENGTH,
  QUERY_MIN_LENGTH,
} from '@build-5/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { combineLatest, map } from 'rxjs';
import { build5Db } from '../firebase/firestore/build5Db';
import { CommonJoi } from '../services/joi/common';
import { getHeadCountObs, getQueryParams } from './common';
import { sendLiveUpdates } from './keepAlive';

const getAvgPriceSchema = Joi.object({
  token: Joi.alternatives()
    .try(
      CommonJoi.uid(),
      Joi.array().min(QUERY_MIN_LENGTH).max(QUERY_MAX_LENGTH).items(CommonJoi.uid()),
    )
    .required(),
  sessionId: CommonJoi.sessionId(true),
});

export const getAvgPrice = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetAvgPriceRequest>(req, res, getAvgPriceSchema);
  if (!body) {
    return;
  }
  const tokens = Array.isArray(body.token) ? body.token : [body.token];
  const changes = tokens.map(getAvgLive);
  const result = combineLatest(changes).pipe(map((r) => (r.length === 1 ? r[0] : r)));
  await sendLiveUpdates(res, result);
};

const getAvgLive = (token: string) => {
  const lowestPurchaseObs = getHeadCountObs(purchaseQuery(token, true));
  const highestPurchaseObs = getHeadCountObs(purchaseQuery(token, false));
  const lastPurchaseObs = getHeadCountObs(purchaseQuery(token));
  return combineLatest([lowestPurchaseObs, highestPurchaseObs, lastPurchaseObs]).pipe(
    map(([lowest, highest, last]) => (highest + lowest + last) / 3),
    map((avg) => ({ id: token, avg })),
  );
};

const purchaseQuery = (token: string, lowest?: boolean) => {
  if (lowest === undefined) {
    build5Db()
      .collection(PublicCollections.TOKEN_PURCHASE)
      .where('token', '==', token)
      .orderBy('createdOn', 'desc')
      .limit(1);
  }
  return build5Db()
    .collection(PublicCollections.TOKEN_PURCHASE)
    .where('token', '==', token)
    .where('age.in7d', '==', true)
    .orderBy('price', lowest ? 'asc' : 'desc')
    .limit(1);
};
