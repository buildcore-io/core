import {
  COL,
  GetManyAdvancedRequest,
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_VALUE_LENGTH,
  Opr,
  PublicCollections,
  PublicSubCollections,
  TransactionType,
  WenError,
} from '@build5/interfaces';
import * as express from 'express';
import * as functions from 'firebase-functions/v2';
import Joi from 'joi';
import { get, isEmpty, isEqual } from 'lodash';
import { map } from 'rxjs';
import { getSnapshot, soonDb } from '../firebase/firestore/soondb';
import { CommonJoi } from '../services/joi/common';
import { invalidArgument } from '../utils/error.utils';
import { getQueryLimit, getQueryParams, queryToObservable } from './common';
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

  limit: Joi.number().min(1).max(100).optional(),

  startAfter: CommonJoi.uid(false),
  sessionId: CommonJoi.sessionId(),
});

export const getManyAdvanced = async (req: functions.https.Request, res: express.Response) => {
  const body = getQueryParams<GetManyAdvancedRequest>(req, res, getManyAdvancedSchema);
  if (!body) {
    return;
  }

  const { collection, subCollection, uid } = body;
  let query = getBaseQuery(collection, uid, subCollection).limit(getQueryLimit(body.collection));

  const { filters, operators } = getFilters(body.fieldName, body.fieldValue, body.operator);
  try {
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

  if (body.collection === PublicCollections.NFT && !isEqual(filters['hidden'], [false])) {
    query = query.where('hidden', '==', false);
  }

  const typeFilters = filters['type'];
  if (
    body.collection === PublicCollections.TRANSACTION &&
    (!typeFilters || typeFilters.includes(TransactionType.ORDER))
  ) {
    query = query.where('isOrderType', '==', false);
  }

  if (body.startAfter) {
    const startAfter = await getSnapshot(
      body.collection,
      body.uid || body.startAfter,
      body.subCollection,
      body.startAfter,
    );
    query = query.startAfter(startAfter);
  }

  if (body.limit) {
    query = query.limit(body.limit);
  }

  const orderByDir = (body.orderByDir || []) as ('asc' | 'desc')[];
  for (let i = 0; i < (body.orderBy?.length || 0); ++i) {
    query = query.orderBy(body.orderBy![i], orderByDir[i]);
  }

  if (body.sessionId) {
    const observable = queryToObservable<Record<string, unknown>>(query).pipe(
      map((snap) => snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }))),
    );
    await sendLiveUpdates(body.sessionId, res, observable);
    return;
  }

  const snap = await query.get<Record<string, unknown>>();
  const result = snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }));
  res.send(result);
};

const getFilters = (fieldNames?: string[], fieldValues?: unknown[], fieldOperators?: Opr[]) => {
  if (!fieldNames || !fieldValues || !fieldOperators) {
    return { filters: {}, operators: {} };
  }
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
