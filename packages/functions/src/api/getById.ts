import { GetByIdRequest, PublicCollections, PublicSubCollections } from '@soon/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import admin from '../admin.config';
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

export const getById = async (req: functions.https.Request, res: functions.Response) => {
  const body = getQueryParams<GetByIdRequest>(req, res, getByIdSchema);
  if (!body) {
    return;
  }

  const docPath =
    body.parentUid && body.subCollection
      ? `${body.collection}/${body.parentUid}/${body.subCollection}/${body.uid}`
      : `${body.collection}/${body.uid}`;
  const docRef = admin.firestore().doc(docPath);
  const data = (await docRef.get()).data();

  if (!data || isHiddenNft(body.collection, data)) {
    res.status(404);
    return;
  }

  res.send(data);
};
