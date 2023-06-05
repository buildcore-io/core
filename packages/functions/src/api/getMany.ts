import {
  COL,
  GetManyRequest,
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_VALUE_LENGTH,
  PublicCollections,
  PublicSubCollections,
  WenError,
} from '@soonaverse/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { get, isEmpty } from 'lodash';
import { map } from 'rxjs';
import { getSnapshot, soonDb } from '../firebase/firestore/soondb';
import { CommonJoi } from '../services/joi/common';
import { invalidArgument } from '../utils/error.utils';
import { getQueryLimit, getQueryParams, queryToObservable } from './common';
import { sendLiveUpdates } from './keepAlive';

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
    .try(fieldNameSchema, Joi.array().min(1).items(fieldNameSchema))
    .optional(),
  fieldValue: Joi.alternatives()
    .conditional('fieldName', {
      is: fieldNameSchema,
      then: fieldValueSchema,
      otherwise: Joi.array().min(1).length(Joi.ref('fieldName.length')).items(fieldValueSchema),
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
    try {
      const filters = getFilters(body.fieldName, body.fieldValue);
      Object.entries(filters).forEach(([key, value]) => {
        const hasMany = value.length > 1;
        query = query.where(key, hasMany ? 'in' : '==', hasMany ? value : value[0]);
      });
    } catch (error) {
      res.status(400);
      res.send(get(error, 'details.key', 'unknown'));
      return;
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

  if (body.live) {
    const observable = queryToObservable<Record<string, unknown>>(query).pipe(
      map((snap) => snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }))),
    );
    await sendLiveUpdates(res, observable);
    return;
  }

  const snap = await query.get<Record<string, unknown>>();
  const result = snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }));
  res.send(result);
};

const getFilters = (fieldNames: string | string[], fieldValues: unknown | unknown[]) => {
  const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
  const value = Array.isArray(fieldValues) ? fieldValues : [fieldValues];
  const filters = names.reduce(
    (acc, act, index) => ({ ...acc, [act]: get(acc, act, []).concat(value[index]) }),
    {} as Record<string, unknown[]>,
  );

  if (Object.keys(filters).length > 8) {
    throw invalidArgument(WenError.max_8_unique_field_names);
  }
  for (const value of Object.values(filters)) {
    if (value.length > 10) {
      throw invalidArgument(WenError.max_10_fields);
    }
  }

  return filters;
};
