import { IQuery, PgTokenPurchase, database } from '@buildcore/database';
import {
  COL,
  GetPriceChangeRequest,
  QUERY_MAX_LENGTH,
  QUERY_MIN_LENGTH,
  TokenPurchase,
} from '@buildcore/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { combineLatest, map } from 'rxjs';
import { CommonJoi, getHeadPriceObs, getQueryParams } from './common';

const getAvgPriceSchema = Joi.object({
  token: Joi.alternatives()
    .try(
      CommonJoi.uid(),
      Joi.array().min(QUERY_MIN_LENGTH).max(QUERY_MAX_LENGTH).items(CommonJoi.uid()),
    )
    .required(),
});

export const getPriceChange = async (url: string, isLive: boolean) => {
  const body = getQueryParams<GetPriceChangeRequest>(url, getAvgPriceSchema);

  const tokens = Array.isArray(body.token) ? body.token : [body.token];

  const changes = tokens.map((t) => getPriceChangeLive(t, isLive));
  return combineLatest(changes).pipe(map((r) => (r.length === 1 ? r[0] : r)));
};

const getPriceChangeLive = (token: string, isLive: boolean) => {
  const today = getVWAPForDates(token, purchaseQueryToday, isLive);
  const yesterday = getVWAPForDates(token, purchaseQueryYesterday, isLive);
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
  queryBuilder: (token: string, lowest?: boolean) => IQuery<TokenPurchase, PgTokenPurchase>,
  isLive: boolean,
) => {
  const lowestPurchaseObs = getHeadPriceObs(queryBuilder(token, true), isLive);
  const highestPurchaseObs = getHeadPriceObs(queryBuilder(token, false), isLive);
  const lastPurchaseObs = getHeadPriceObs(queryBuilder(token), isLive);
  return combineLatest([lowestPurchaseObs, highestPurchaseObs, lastPurchaseObs]).pipe(
    map(([lowest, highest, last]) => (highest + lowest + last) / 3),
  );
};

const purchaseQueryToday = (token: string, lowest?: boolean) => {
  if (lowest === undefined) {
    return database()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', token)
      .where('createdOn', '>=', dayjs().subtract(1, 'd').toDate())
      .orderBy('createdOn', 'desc')
      .limit(1);
  }
  if (lowest) {
    return database()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', token)
      .where('in24h', '==', true)
      .orderBy('price')
      .limit(1);
  }
  return database()
    .collection(COL.TOKEN_PURCHASE)
    .where('token', '==', token)
    .where('in24h', '==', true)
    .orderBy('price', 'desc')
    .limit(1);
};

const purchaseQueryYesterday = (token: string, lowest?: boolean) => {
  if (lowest === undefined) {
    return database()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', token)
      .where('createdOn', '<', dayjs().subtract(1, 'd').toDate())
      .where('createdOn', '>=', dayjs().subtract(2, 'd').toDate())
      .orderBy('createdOn', 'desc')
      .limit(1);
  }
  if (lowest) {
    return database()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', token)
      .where('in48h', '==', true)
      .where('in7d', '==', true)
      .orderBy('price')
      .limit(1);
  }

  return database()
    .collection(COL.TOKEN_PURCHASE)
    .where('token', '==', token)
    .where('in48h', '==', true)
    .where('in7d', '==', true)
    .orderBy('price', 'desc')
    .limit(1);
};
