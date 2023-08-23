import {
  GetPriceChangeRequest,
  PublicCollections,
  QUERY_MAX_LENGTH,
  QUERY_MIN_LENGTH,
  TokenPurchaseAge,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { combineLatest, map } from 'rxjs';
import { build5Db } from '../firebase/firestore/build5Db';
import { IQuery } from '../firebase/firestore/interfaces';
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

export const getPriceChange = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetPriceChangeRequest>(req, res, getAvgPriceSchema);
  if (!body) {
    return;
  }

  const tokens = Array.isArray(body.token) ? body.token : [body.token];
  const changes = tokens.map(getPriceChangeLive);
  const result = combineLatest(changes).pipe(map((r) => (r.length === 1 ? r[0] : r)));
  await sendLiveUpdates(res, result);
};

const getPriceChangeLive = (token: string) => {
  const today = getVWAPForDates(token, purchaseQueryToday);
  const yesterday = getVWAPForDates(token, purchaseQueryYesterday);
  return combineLatest([today, yesterday]).pipe(
    map(([last, secondToLast]) => {
      if (!secondToLast) {
        return { id: token, change: 0 };
      }
      return { id: token, change: (last - secondToLast) / last };
    }),
  );
};

const getVWAPForDates = (
  token: string,
  queryBuilder: (token: string, lowest?: boolean) => IQuery,
) => {
  const lowestPurchaseObs = getHeadCountObs(queryBuilder(token, true));
  const highestPurchaseObs = getHeadCountObs(queryBuilder(token, false));
  const lastPurchaseObs = getHeadCountObs(queryBuilder(token));
  return combineLatest([lowestPurchaseObs, highestPurchaseObs, lastPurchaseObs]).pipe(
    map(([lowest, highest, last]) => (highest + lowest + last) / 3),
  );
};

const purchaseQueryToday = (token: string, lowest?: boolean) => {
  if (lowest === undefined) {
    build5Db()
      .collection(PublicCollections.TOKEN_PURCHASE)
      .where('token', '==', token)
      .where('createdOn', '>=', dayjs().subtract(1, 'd').toDate())
      .orderBy('createdOn', 'desc')
      .limit(1);
  }
  return build5Db()
    .collection(PublicCollections.TOKEN_PURCHASE)
    .where('token', '==', token)
    .where(`age.${TokenPurchaseAge.IN_24_H}`, '==', true)
    .orderBy('price', lowest ? 'asc' : 'desc')
    .limit(1);
};

const purchaseQueryYesterday = (token: string, lowest?: boolean) => {
  if (lowest === undefined) {
    build5Db()
      .collection(PublicCollections.TOKEN_PURCHASE)
      .where('token', '==', token)
      .where('createdOn', '<', dayjs().subtract(1, 'd').toDate())
      .where('createdOn', '>=', dayjs().subtract(2, 'd').toDate())
      .orderBy('createdOn', 'desc')
      .limit(1);
  }
  return build5Db()
    .collection(PublicCollections.TOKEN_PURCHASE)
    .where('token', '==', token)
    .where(`age.${TokenPurchaseAge.IN_24_H}`, '==', false)
    .where(`age.${TokenPurchaseAge.IN_48_H}`, '==', true)
    .orderBy('price', lowest ? 'asc' : 'desc')
    .limit(1);
};
