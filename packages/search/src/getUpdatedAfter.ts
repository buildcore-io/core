import { build5Db, getSnapshot } from '@build-5/database';
import {
  COL,
  Dataset,
  GetUpdatedAfterRequest,
  MAX_MILLISECONDS,
  Subset,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import { map } from 'rxjs';
import {
  CommonJoi,
  getQueryLimit,
  getQueryParams,
  queryToObservable,
  shouldSetProjectFilter,
} from './common';

const getUpdatedAfterSchema = Joi.object({
  dataset: Joi.string()
    .equal(...Object.values(Dataset))
    .required(),
  setId: CommonJoi.uid(false),
  subCollection: Joi.string()
    .equal(...Object.values(Subset))
    .optional(),
  updatedAfter: Joi.number().min(0).max(MAX_MILLISECONDS).integer().optional(),
  startAfter: CommonJoi.uid(false),
});

export const getUpdatedAfter = async (project: string, url: string) => {
  const body = getQueryParams<GetUpdatedAfterRequest>(url, getUpdatedAfterSchema);

  const isSubCollectionQuery = body.subset && body.setId;
  const baseCollectionPath = isSubCollectionQuery
    ? `${body.dataset}/${body.setId}/${body.subset}`
    : body.dataset;

  const updatedAfter = body.updatedAfter ? dayjs(body.updatedAfter) : dayjs().subtract(1, 'h');

  let query = build5Db()
    .collection(baseCollectionPath as COL)
    .where('updatedOn', '>=', updatedAfter.toDate())
    .orderBy('updatedOn')
    .limit(getQueryLimit(body.dataset));

  if (body.dataset === Dataset.NFT) {
    query = query.where('hidden', '==', false);
  }

  if (body.dataset === Dataset.TRANSACTION) {
    query = query.where('isOrderType', '==', false);
  }

  if (shouldSetProjectFilter(body.dataset, body.subset)) {
    query = query.where('project', '==', project);
  }

  if (body.startAfter) {
    const startAfter = await getSnapshot(baseCollectionPath as COL, body.startAfter);
    query = query.startAfter(startAfter);
  }

  return queryToObservable<Record<string, unknown>>(query).pipe(
    map((snap) => snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }))),
  );
};
