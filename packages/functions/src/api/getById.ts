import { GetByIdRequest, PublicCollections, PublicSubCollections } from '@soonaverse/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { map } from 'rxjs';
import { soonDb } from '../firebase/firestore/soondb';
import { CommonJoi } from '../services/joi/common';
import { maxAddressLength } from '../utils/wallet.utils';
import { documentToObservable, getQueryParams, isHiddenNft } from './common';
import { sendLiveUpdates } from './keepAlive';

const getByIdSchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  parentUid: CommonJoi.uid(false),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  uid: Joi.string().alphanum().min(5).max(maxAddressLength).required(),
  live: Joi.boolean().optional(),
});

export const getById = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetByIdRequest>(req, res, getByIdSchema);
  if (!body) {
    return;
  }

  const docPath =
    body.parentUid && body.subCollection
      ? `${body.collection}/${body.parentUid}/${body.subCollection}/${body.uid}`
      : `${body.collection}/${body.uid}`;
  const docRef = soonDb().doc(docPath);

  if (body.live) {
    const observable = documentToObservable<Record<string, unknown>>(docRef).pipe(
      map((data) => {
        if (!data || isHiddenNft(body.collection, data)) {
          return {};
        }
        return data;
      }),
    );
    await sendLiveUpdates(res, observable);
    return;
  }

  const data = await docRef.get<Record<string, unknown>>();
  if (!data || isHiddenNft(body.collection, data)) {
    res.status(404);
    res.send({});
    return;
  }

  res.send({ id: data.uid || '', ...data });
};
