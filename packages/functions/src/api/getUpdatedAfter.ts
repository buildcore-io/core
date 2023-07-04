import {
  COL,
  GetUpdatedAfterRequest,
  MAX_MILLISECONDS,
  PublicCollections,
  PublicSubCollections,
} from '@build-5/interfaces';
import dayjs from 'dayjs';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import { map } from 'rxjs';
import { build5Db, getSnapshot } from '../firebase/firestore/build5Db';
import { CommonJoi } from '../services/joi/common';
import { getQueryLimit, getQueryParams, queryToObservable } from './common';
import { sendLiveUpdates } from './keepAlive';

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
  sessionId: CommonJoi.sessionId(),
});

export const getUpdatedAfter = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetUpdatedAfterRequest>(req, res, getUpdatedAfterSchema);
  if (!body) {
    return;
  }

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

  if (body.startAfter) {
    const startAfter = await getSnapshot(baseCollectionPath as COL, body.startAfter);
    query = query.startAfter(startAfter);
  }

  if (body.sessionId) {
    const observable = queryToObservable<Record<string, unknown>>(query).pipe(
      map((snap) => snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }))),
    );
    await sendLiveUpdates(body.sessionId, res, observable);
    return;
  }

  const snap = await query.get<Record<string, unknown>>();
  const result = snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }));
  res.send(result);
};
