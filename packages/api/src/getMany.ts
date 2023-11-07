import { build5Db, getSnapshot } from '@build-5/database';
import {
  COL,
  GetManyRequest,
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_VALUE_LENGTH,
  PublicCollections,
  PublicSubCollections,
  WenError,
} from '@build-5/interfaces';
import Joi from 'joi';
import { get, isEmpty } from 'lodash';
import { map } from 'rxjs';
import { CommonJoi, getQueryLimit, getQueryParams, queryToObservable } from './common';

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
});

export const getMany = async (project: string, url: string) => {
  const body = getQueryParams<GetManyRequest>(url, getManySchema);

  const baseCollectionPath =
    body.subCollection && body.uid
      ? `${body.collection}/${body.uid}/${body.subCollection}`
      : body.collection;
  let query = build5Db()
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
      throw { code: 400, message: get(error, 'details.key', 'unknown') };
    }
  }

  if (body.collection === PublicCollections.NFT) {
    query = query.where('hidden', '==', false);
  }

  if (body.collection === PublicCollections.TRANSACTION) {
    query = query.where('isOrderType', '==', false);
  }

  query = query.where('projects', 'array-contains', project);

  if (body.startAfter) {
    const startAfter = getSnapshot(
      body.collection,
      body.uid || body.startAfter,
      body.subCollection,
      body.startAfter,
    );
    query = query.startAfter(await startAfter);
  }

  const observable = queryToObservable<Record<string, unknown>>(query).pipe(
    map((snap) => snap.filter((d) => !isEmpty(d)).map((d) => ({ id: d.uid, ...d }))),
  );
  return observable;
};

const getFilters = (fieldNames: string | string[], fieldValues: unknown | unknown[]) => {
  const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
  const value = Array.isArray(fieldValues) ? fieldValues : [fieldValues];
  const filters = names.reduce(
    (acc, act, index) => ({ ...acc, [act]: get(acc, act, []).concat(value[index]) }),
    {} as Record<string, unknown[]>,
  );

  if (Object.keys(filters).length > 8) {
    throw { code: 400, message: WenError.max_8_unique_field_names.key };
  }
  for (const value of Object.values(filters)) {
    if (value.length > 10) {
      throw { code: 400, message: WenError.max_10_fields.key };
    }
  }
  return filters;
};
