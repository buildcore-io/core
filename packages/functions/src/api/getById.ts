import { GetByIdRequest, PublicCollections, PublicSubCollections } from '@soonaverse/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { soonDb } from '../firebase/firestore/soondb';
import { CommonJoi } from '../services/joi/common';
import { getQueryParams, isHiddenNft } from './common';

const getByIdSchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  parentUid: CommonJoi.uid(false),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  uid: CommonJoi.uid(),
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
  const data = await docRef.get<Record<string, unknown>>();

  if (!data || isHiddenNft(body.collection, data)) {
    res.status(404);
    res.send({});
    return;
  }

  res.send({ id: data.uid || '', ...data });
};
