import {
  COL,
  GetManyAdvancedRequest,
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_VALUE_LENGTH,
  Opr,
  PublicCollections,
  PublicSubCollections,
  WenError,
} from '@soonaverse/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { get, isEmpty } from 'lodash';
import { getSnapshot, soonDb } from '../firebase/firestore/soondb';
import { CommonJoi } from '../services/joi/common';
import { invalidArgument } from '../utils/error.utils';
import { getQueryLimit, getQueryParams } from './common';
import { sendLiveUpdates } from './keepAlive';

const fieldNameSchema = Joi.string().max(MAX_FIELD_NAME_LENGTH);
const fieldValueSchema = Joi.alternatives().try(
  Joi.date(),
  Joi.boolean(),
  Joi.number(),
  Joi.string().max(MAX_FIELD_VALUE_LENGTH),
);

const operatorSchema = Joi.string().equal(...Object.values(Opr));

const getManyAdvancedSchema = Joi.object({
  collection: Joi.string()
    .equal(...Object.values(PublicCollections))
    .required(),
  uid: CommonJoi.uid(false),
  subCollection: Joi.string()
    .equal(...Object.values(PublicSubCollections))
    .optional(),
  fieldName: Joi.array().items(fieldNameSchema).optional(),
  fieldValue: Joi.array().length(Joi.ref('fieldName.length')).items(fieldValueSchema).optional(),
  operator: Joi.array().length(Joi.ref('fieldName.length')).items(operatorSchema).optional(),

  orderBy: Joi.array().min(1).items(fieldNameSchema).optional(),
  orderByDir: Joi.array().min(1).items(Joi.string().valid('asc', 'desc')).optional(),

  startAfter: CommonJoi.uid(false),
  live: Joi.boolean().optional(),
});

export const getManyAdvanced = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetManyAdvancedRequest>(req, res, getManyAdvancedSchema);
  if (!body) {
    return;
  }

  const { collection, subCollection, uid } = body;
  let query = getBaseQuery(collection, uid, subCollection).limit(getQueryLimit(body.collection));

  if (body.fieldName?.length) {
    try {
      const { filters, operators } = getFilters(body.fieldName, body.fieldValue!, body.operator!);
      for (const [key, values] of Object.entries(filters)) {
        if (operators[key][0] === Opr.IN) {
          query = query.where(key, operators[key][0], values);
          continue;
        }
        for (let i = 0; i < values.length; ++i) {
          query = query.where(key, operators[key][i], values[i]);
        }
      }
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

  const orderByDir = (body.orderByDir || []) as ('asc' | 'desc')[];
  for (let i = 0; i < (body.orderBy?.length || 0); ++i) {
    query = query.orderBy(body.orderBy![i], orderByDir[i]);
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

const getFilters = (fieldNames: string[], fieldValues: unknown[], fieldOperators: Opr[]) => {
  const nameAndValues = fieldNames.reduce(
    (acc, act, index) => ({ ...acc, [act]: [...get(acc, act, []), fieldValues[index]] }),
    {} as Record<string, unknown[]>,
  );
  const nameAndOperators = fieldNames.reduce(
    (acc, act, index) => ({ ...acc, [act]: [...get(acc, act, []), fieldOperators[index]] }),
    {} as Record<string, Opr[]>,
  );

  if (Object.keys(nameAndValues).length > 8) {
    throw invalidArgument(WenError.max_8_unique_field_names);
  }

  for (const value of Object.values(nameAndValues)) {
    if (value.length > 10) {
      throw invalidArgument(WenError.max_10_fields);
    }
  }

  return { filters: nameAndValues, operators: nameAndOperators };
};

const getBaseQuery = (col: PublicCollections, uid?: string, subCol?: PublicSubCollections) => {
  if (!uid && subCol) {
    return soonDb().collectionGroup(subCol);
  }
  const path = subCol && uid ? `${col}/${uid}/${subCol}` : col;
  return soonDb().collection(path as COL);
};
