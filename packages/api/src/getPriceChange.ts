import { IQuery, build5Db } from '@build-5/database';
import {
  GetPriceChangeRequest,
  PublicCollections,
  QUERY_MAX_LENGTH,
  QUERY_MIN_LENGTH,
  TokenPurchaseAge,
} from '@build-5/interfaces';
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

export const getPriceChange = async (url: string) => {
  const body = getQueryParams<GetPriceChangeRequest>(url, getAvgPriceSchema);

  const tokens = Array.isArray(body.token) ? body.token : [body.token];

  const changes = tokens.map(getPriceChangeLive);
  return combineLatest(changes).pipe(map((r) => (r.length === 1 ? r[0] : r)));
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
  const lowestPurchaseObs = getHeadPriceObs(queryBuilder(token, true));
  const highestPurchaseObs = getHeadPriceObs(queryBuilder(token, false));
  const lastPurchaseObs = getHeadPriceObs(queryBuilder(token));
  return combineLatest([lowestPurchaseObs, highestPurchaseObs, lastPurchaseObs]).pipe(
    map(([lowest, highest, last]) => (highest + lowest + last) / 3),
  );
};

const purchaseQueryToday = (token: string, lowest?: boolean) => {
  if (lowest === undefined) {
    return build5Db()
      .collection(PublicCollections.TOKEN_PURCHASE)
      .where('token', '==', token)
      .where('createdOn', '>=', dayjs().subtract(1, 'd').toDate())
      .orderBy('createdOn')
      .limitToLast(1);
  }
  const query = build5Db()
    .collection(PublicCollections.TOKEN_PURCHASE)
    .where('token', '==', token)
    .where('age', 'array-contains', TokenPurchaseAge.IN_24_H)
    .orderBy('price', 'asc');
  if (lowest) {
    return query.limit(1);
  }
  return query.limitToLast(1);
};

const purchaseQueryYesterday = (token: string, lowest?: boolean) => {
  if (lowest === undefined) {
    return build5Db()
      .collection(PublicCollections.TOKEN_PURCHASE)
      .where('token', '==', token)
      .where('createdOn', '<', dayjs().subtract(1, 'd').toDate())
      .where('createdOn', '>=', dayjs().subtract(2, 'd').toDate())
      .orderBy('createdOn')
      .limitToLast(1);
  }
  const query = build5Db()
    .collection(PublicCollections.TOKEN_PURCHASE)
    .where('token', '==', token)
    .where('age', '==', [TokenPurchaseAge.IN_48_H, TokenPurchaseAge.IN_7_D])
    .orderBy('price', 'asc');
  if (lowest) {
    return query.limit(1);
  }
  return query.limitToLast(1);
};
