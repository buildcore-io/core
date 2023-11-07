import { build5Db, getSnapshot } from '@build-5/database';
import {
  COL,
  GetManyAdvancedRequest,
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_VALUE_LENGTH,
  Opr,
  PublicCollections,
  PublicSubCollections,
  QUERY_MAX_LENGTH,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import Joi from 'joi';
import { get, isEmpty, isEqual } from 'lodash';
import { map } from 'rxjs';
import { CommonJoi, getQueryLimit, getQueryParams, queryToObservable } from './common';

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

  limit: Joi.number().min(1).max(QUERY_MAX_LENGTH).optional(),

  startAfter: CommonJoi.uid(false),
});

export const getManyAdvanced = async (project: string, url: string) => {
  const body = getQueryParams<GetManyAdvancedRequest>(url, getManyAdvancedSchema);

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
    throw { code: 400, message: get(error, 'details.key', 'unknown') };
  }

  if (body.collection === PublicCollections.NFT && !isEqual(filters['hidden'], [false])) {
    query = query.where('hidden', '==', false);
  }

  query = query.where('project', '==', project);

  const typeFilters = filters['type'];
  if (
    body.collection === PublicCollections.TRANSACTION &&
    (!typeFilters || typeFilters.includes(TransactionType.ORDER))
  ) {
    query = query.where('isOrderType', '==', false);
  }

  const orderByDir = (body.orderByDir || []) as ('asc' | 'desc')[];
  for (let i = 0; i < (body.orderBy?.length || 0); ++i) {
    query = query.orderBy(body.orderBy![i], orderByDir[i]);
  }

  if (body.limit) {
    query = query.limit(body.limit);
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

  return queryToObservable<Record<string, unknown>>(query).pipe(
    map((snap) => snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }))),
  );
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
    throw { code: 400, message: WenError.max_8_unique_field_names.key };
  }

  for (const value of Object.values(nameAndValues)) {
    if (value.length > 10) {
      throw { code: 400, message: WenError.max_10_fields.key };
    }
  }

  return { filters: nameAndValues, operators: nameAndOperators };
};

const getBaseQuery = (col: PublicCollections, uid?: string, subCol?: PublicSubCollections) => {
  if (!uid && subCol) {
    return build5Db().collectionGroup(subCol);
  }
  const path = subCol && uid ? `${col}/${uid}/${subCol}` : col;
  return build5Db().collection(path as COL);
};
