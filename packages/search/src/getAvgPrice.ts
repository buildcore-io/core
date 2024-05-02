import { build5Db } from '@build-5/database';
import { COL, GetAvgPriceRequest, QUERY_MAX_LENGTH, QUERY_MIN_LENGTH } from '@build-5/interfaces';
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

export const getAvgPrice = async (url: string, isLive: boolean) => {
  const body = getQueryParams<GetAvgPriceRequest>(url, getAvgPriceSchema);

  const tokens = Array.isArray(body.token) ? body.token : [body.token];
  const changes = tokens.map((t) => getAvgLive(t, isLive));
  const observable = combineLatest(changes).pipe(map((r) => (r.length === 1 ? r[0] : r)));

  return observable;
};

const getAvgLive = (token: string, isLive: boolean) => {
  const lowestPurchaseObs = getHeadPriceObs(purchaseQuery(token, true), isLive);
  const highestPurchaseObs = getHeadPriceObs(purchaseQuery(token, false), isLive);
  const lastPurchaseObs = getHeadPriceObs(purchaseQuery(token), isLive);
  return combineLatest([lowestPurchaseObs, highestPurchaseObs, lastPurchaseObs]).pipe(
    map(([lowest, highest, last]) => (highest + lowest + last) / 3),
    map((avg) => ({ id: token, avg })),
  );
};

const purchaseQuery = (token: string, lowest?: boolean) => {
  if (lowest === undefined) {
    return build5Db()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', token)
      .orderBy('createdOn', 'desc')
      .limit(1);
  }
  if (lowest) {
    return build5Db()
      .collection(COL.TOKEN_PURCHASE)
      .where('token', '==', token)
      .where('in7d', '==', true)
      .orderBy('price', 'asc')
      .limit(1);
  }
  return build5Db()
    .collection(COL.TOKEN_PURCHASE)
    .where('token', '==', token)
    .where('in7d', '==', true)
    .orderBy('price', 'desc')
    .limit(1);
};
