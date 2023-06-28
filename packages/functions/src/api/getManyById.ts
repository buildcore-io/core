import { GetManyByIdRequest, PublicCollections, PublicSubCollections } from '@build-5/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { chunk, uniq } from 'lodash';
import { combineLatest, map } from 'rxjs';
import { build5Db } from '../firebase/firestore/build5Db';
import { CommonJoi } from '../services/joi/common';
import { maxAddressLength } from '../utils/wallet.utils';
import { getQueryParams, isHiddenNft, queryToObservable } from './common';
import { sendLiveUpdates } from './keepAlive';

const uidSchema = Joi.string().alphanum().min(5).max(maxAddressLength).required();
const getManyByIdSchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  parentUid: CommonJoi.uid(false),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  uids: Joi.array().items(uidSchema).max(100),
  sessionId: CommonJoi.sessionId(),
});

export const getManyById = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetManyByIdRequest>(req, res, getManyByIdSchema);
  if (!body) {
    return;
  }

  const baseQuery = getBaseQuery(body);

  const queries = chunk(uniq(body.uids), 10).map((uids) => baseQuery.where('uid', 'in', uids));

  if (body.sessionId) {
    const observables = queries.map(queryToObservable<Record<string, unknown>>);
    const observable = combineLatest(observables).pipe(
      map((all) => all.flat().filter((record) => record && !isHiddenNft(body.collection, record))),
    );
    await sendLiveUpdates(body.sessionId, res, observable);
    return;
  }

  const promises = queries.map((query) => query.get<Record<string, unknown>>());
  const data = (await Promise.all(promises)).flat();

  res.send(data);
};

const getBaseQuery = (body: GetManyByIdRequest) => {
  if (body.subCollection) {
    if (body.parentUid) {
      return build5Db()
        .collection(body.collection)
        .doc(body.parentUid)
        .collection(body.subCollection);
    }
    return build5Db().collectionGroup(body.subCollection).where('parentCol', '==', body.collection);
  }
  return build5Db().collection(body.collection);
};
