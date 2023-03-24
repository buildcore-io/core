import {
  COL,
  GetManyRequest,
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_VALUE_LENGTH,
  PublicCollections,
  PublicSubCollections,
} from '@soonaverse/interfaces';
import * as functions from 'firebase-functions';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import { getSnapshot, soonDb } from '../firebase/firestore/soondb';
import { CommonJoi } from '../services/joi/common';
import { getQueryLimit, getQueryParams } from './common';

const MAX_WHERE_STATEMENTS = 8;

const fieldNameSchema = Joi.string().max(MAX_FIELD_NAME_LENGTH);
const fieldValueSchema = Joi.alternatives().try(
  Joi.boolean(),
  Joi.number(),
  Joi.string().max(MAX_FIELD_VALUE_LENGTH),
);

const getManySchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  uid: CommonJoi.uid(false),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  fieldName: Joi.alternatives()
    .try(fieldNameSchema, Joi.array().min(1).max(MAX_WHERE_STATEMENTS).items(fieldNameSchema))
    .optional(),
  fieldValue: Joi.alternatives()
    .conditional('fieldName', {
      is: fieldNameSchema,
      then: fieldValueSchema,
      otherwise: Joi.array().min(1).max(MAX_WHERE_STATEMENTS).items(fieldValueSchema),
    })
    .optional(),
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
  let query = soonDb()
    .collection(baseCollectionPath as COL)
    .limit(getQueryLimit(body.collection));

  if (body.fieldName && body.fieldValue != null) {
    const fieldNames = Array.isArray(body.fieldName) ? body.fieldName : [body.fieldName];
    const fieldValue = Array.isArray(body.fieldValue) ? body.fieldValue : [body.fieldValue];
    for (let i = 0; i < fieldNames.length; ++i) {
      query = query.where(fieldNames[i], '==', fieldValue[i]);
    }
  }

  if (body.collection === PublicCollections.NFT) {
    query = query.where('hidden', '==', false);
  }

  if (body.collection === PublicCollections.TRANSACTION) {
    query = query.where('isOrderType', '==', false);
  }

  if (body.startAfter) {
    const startAfter = getSnapshot(
      body.collection,
      body.uid || body.startAfter,
      body.subCollection,
      body.startAfter,
    );
    query = query.startAfter(await startAfter);
  }

  const snap = await query.get<Record<string, unknown>>();
  const result = snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }));
  res.send(result);
};
