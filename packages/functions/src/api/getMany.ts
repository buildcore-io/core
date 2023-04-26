import {
  COL,
  GetManyRequest,
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_VALUE_LENGTH,
  PublicCollections,
  PublicSubCollections,
} from '@soonaverse/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { isEmpty } from 'lodash';
import { getSnapshot, soonDb } from '../firebase/firestore/soondb';
import { CommonJoi } from '../services/joi/common';
import { getQueryLimit, getQueryParams } from './common';
import { sendLiveUpdates } from './keepAlive';

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
      otherwise: Joi.array()
        .min(1)
        .max(MAX_WHERE_STATEMENTS)
        .length(Joi.ref('fieldName.length'))
        .items(fieldValueSchema),
    })
    .optional(),
  startAfter: CommonJoi.uid(false),
  live: Joi.boolean().optional(),
});

export const getMany = async (req: functions.https.Request, res: express.Response) => {
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
    const filters = fieldNames.reduce(
      (acc, act, index) => ({ ...acc, [act]: (acc[act] || []).concat(fieldValue[index]) }),
      {} as Record<string, unknown[]>,
    );
    Object.entries(filters).forEach(([key, value]) => {
      const hasMany = value.length > 1;
      query = query.where(key, hasMany ? 'in' : '==', hasMany ? value : value[0]);
    });
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

  if (body.live) {
    await sendLiveUpdates(res, query.onSnapshot, (snap: Record<string, unknown>[]) =>
      snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d })),
    );
    return;
  }

  const snap = await query.get<Record<string, unknown>>();
  const result = snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }));
  res.send(result);
};
