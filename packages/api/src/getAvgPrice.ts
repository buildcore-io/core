import { build5Db } from '@build-5/database';
import {
  GetAvgPriceRequest,
  PublicCollections,
  QUERY_MAX_LENGTH,
  QUERY_MIN_LENGTH,
  TokenPurchaseAge,
} from '@build-5/interfaces';
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

export const getAvgPrice = async (url: string) => {
  const body = getQueryParams<GetAvgPriceRequest>(url, getAvgPriceSchema);

  const tokens = Array.isArray(body.token) ? body.token : [body.token];
  const changes = tokens.map(getAvgLive);
  const observable = combineLatest(changes).pipe(map((r) => (r.length === 1 ? r[0] : r)));

  return observable;
};

const getAvgLive = (token: string) => {
  const lowestPurchaseObs = getHeadPriceObs(purchaseQuery(token, true));
  const highestPurchaseObs = getHeadPriceObs(purchaseQuery(token, false));
  const lastPurchaseObs = getHeadPriceObs(purchaseQuery(token));
  return combineLatest([lowestPurchaseObs, highestPurchaseObs, lastPurchaseObs]).pipe(
    map(([lowest, highest, last]) => (highest + lowest + last) / 3),
    map((avg) => ({ id: token, avg })),
  );
};

const purchaseQuery = (token: string, lowest?: boolean) => {
  if (lowest === undefined) {
    return build5Db()
      .collection(PublicCollections.TOKEN_PURCHASE)
      .where('token', '==', token)
      .orderBy('createdOn')
      .limitToLast(1);
  }
  const query = build5Db()
    .collection(PublicCollections.TOKEN_PURCHASE)
    .where('token', '==', token)
    .where('age', 'array-contains', TokenPurchaseAge.IN_7_D)
    .orderBy('price', 'asc');
  if (lowest) {
    return query.limit(1);
  }
  return query.limitToLast(1);
};
