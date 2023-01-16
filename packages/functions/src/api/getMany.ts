import {
  GetManyRequest,
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_VALUE_LENGTH,
  PublicCollections,
  PublicSubCollections,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import admin from '../admin.config';
import { CommonJoi } from '../services/joi/common';
import { getQueryLimit, getQueryParams } from './common';

const getManySchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  uid: CommonJoi.uid(false),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  fieldName: Joi.string().max(MAX_FIELD_NAME_LENGTH).optional(),
  fieldValue: [
    Joi.boolean().optional(),
    Joi.number().optional(),
    Joi.string().max(MAX_FIELD_VALUE_LENGTH).optional(),
  ],
  startAfter: CommonJoi.uid(false),
});

export const getMany = async (req: functions.https.Request, res: functions.Response) => {
  const body = getQueryParams<GetManyRequest>(req, res, getManySchema);
  if (!body) {
    return;
  }

  const baseCollectionPath =
    body.subCollection && body.uid
      ? `${body.collection}/${body.uid}/${body.subCollection}`
      : body.collection;
  let query = admin
    .firestore()
    .collection(baseCollectionPath)
    .limit(getQueryLimit(body.collection));

  if (body.fieldName && body.fieldValue) {
    query = query.where(body.fieldName, '==', body.fieldValue);
  }

  if (body.collection === PublicCollections.NFT) {
    query = query.where('hidden', '==', false);
  }

  if (body.collection === PublicCollections.TRANSACTION) {
    query = query.where('isOrderType', '==', false);
  }

  if (body.startAfter) {
    const path =
      body.subCollection && body.uid
        ? `${body.collection}/${body.uid}/${body.subCollection}/${body.startAfter}`
        : `${body.collection}/${body.startAfter}`;
    const startAfter = await admin.firestore().doc(path).get();
    query = query.startAfter(startAfter);
  }

  const snap = await query.get();
  const result = snap.docs
    .map((d) => d.data())
    .filter((d) => !isEmpty(d))
    .map((d) => ({ id: d.uid, ...d }));
  res.send(result);
};
