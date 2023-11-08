import { build5Db, getSnapshot } from '@build-5/database';
import {
  COL,
  GetUpdatedAfterRequest,
  MAX_MILLISECONDS,
  PublicCollections,
  PublicSubCollections,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import { map } from 'rxjs';
import { CommonJoi, getQueryLimit, getQueryParams, queryToObservable } from './common';

const getUpdatedAfterSchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  uid: CommonJoi.uid(false),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  updatedAfter: Joi.number().min(0).max(MAX_MILLISECONDS).integer().optional(),
  startAfter: CommonJoi.uid(false),
});

export const getUpdatedAfter = async (project: string, url: string) => {
  const body = getQueryParams<GetUpdatedAfterRequest>(url, getUpdatedAfterSchema);

  const isSubCollectionQuery = body.subCollection && body.uid;
  const baseCollectionPath = isSubCollectionQuery
    ? `${body.collection}/${body.uid}/${body.subCollection}`
    : body.collection;

  const updatedAfter = body.updatedAfter ? dayjs(body.updatedAfter) : dayjs().subtract(1, 'h');

  let query = build5Db()
    .collection(baseCollectionPath as COL)
    .where('updatedOn', '>=', updatedAfter.toDate())
    .orderBy('updatedOn')
    .limit(getQueryLimit(body.collection));

  if (body.collection === PublicCollections.NFT) {
    query = query.where('hidden', '==', false);
  }

  if (body.collection === PublicCollections.TRANSACTION) {
    query = query.where('isOrderType', '==', false);
  }

  query = query.where('project', '==', project);

  if (body.startAfter) {
    const startAfter = await getSnapshot(baseCollectionPath as COL, body.startAfter);
    query = query.startAfter(startAfter);
  }

  return queryToObservable<Record<string, unknown>>(query).pipe(
    map((snap) => snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }))),
  );
};
