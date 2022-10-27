import {
  GetManyRequest,
  PublicCollections,
  PublicSubCollections,
  TransactionType,
} from '@soon/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import admin from '../admin.config';
import { CommonJoi } from '../services/joi/common';
import { assertValidation } from '../utils/schema.utils';
import { getQueryLimit } from './common';

const MAX_FIELD_NAME_LENGTH = 30;
const MAX_FIELD_VALUE_LENGTH = 100;
const getAllSchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  uid: CommonJoi.uid(false),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  fieldName: Joi.string().alphanum().max(MAX_FIELD_NAME_LENGTH).optional(),
  fieldValue: [
    Joi.string().alphanum().max(MAX_FIELD_VALUE_LENGTH).optional(),
    Joi.number().optional(),
    Joi.boolean().optional(),
    Joi.date().optional(),
  ],
  startAfter: CommonJoi.uid(false),
});

export const getMany = functions.https.onRequest(async (req, res) => {
  assertValidation(getAllSchema.validate(req.body));
  const body = <GetManyRequest>req.body;

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
    query = query.where('type', '!=', TransactionType.ORDER);
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
  const result = snap.docs.map((d) => d.data()).filter((d) => !isEmpty(d));
  res.send(result);
});