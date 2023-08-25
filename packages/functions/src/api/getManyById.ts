import {
  GetManyByIdRequest,
  PublicCollections,
  PublicSubCollections,
  QUERY_MAX_LENGTH,
} from '@build-5/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { combineLatest, map } from 'rxjs';
import { build5Db } from '../firebase/firestore/build5Db';
import { CommonJoi } from '../services/joi/common';
import { maxAddressLength } from '../utils/wallet.utils';
import { documentToObservable, getQueryParams, isHiddenNft } from './common';
import { sendLiveUpdates } from './keepAlive';

const uidSchema = Joi.string().alphanum().min(5).max(maxAddressLength).required();

const getManyByIdSchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  parentUids: Joi.array().items(CommonJoi.uid(false)).max(QUERY_MAX_LENGTH),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  uids: Joi.array().items(uidSchema).min(1).max(QUERY_MAX_LENGTH).required(),
  sessionId: CommonJoi.sessionId(),
});

export const getManyById = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetManyByIdRequest>(req, res, getManyByIdSchema);
  if (!body) {
    return;
  }

  if (body.sessionId) {
    const observables = getQueries(body).map(documentToObservable<Record<string, unknown>>);
    const observable = combineLatest(observables).pipe(
      map((all) => all.flat().filter((record) => record && !isHiddenNft(body.collection, record))),
    );
    await sendLiveUpdates(res, observable);
    return;
  }

  const promises = getQueries(body).map((query) => query.get<Record<string, unknown>>());
  const data = await Promise.all(promises);

  res.send(data);
};

const getQueries = (body: GetManyByIdRequest) =>
  body.uids.map((uid, i) => {
    if (body.subCollection && body.parentUids?.[i]) {
      return build5Db()
        .collection(body.collection)
        .doc(body.parentUids?.[i])
        .collection(body.subCollection)
        .doc(uid);
    }
    return build5Db().doc(`${body.collection}/${uid}`);
  });
