import { build5Db, getSnapshot } from '@build-5/database';
import {
  COL,
  Dataset,
  GetManyRequest,
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_VALUE_LENGTH,
  Subset,
  WenError,
} from '@build-5/interfaces';
import Joi from 'joi';
import { get, isEmpty } from 'lodash';
import { map } from 'rxjs';
import {
  CommonJoi,
  getQueryLimit,
  getQueryParams,
  queryToObservable,
  shouldSetProjectFilter,
} from './common';

const fieldNameSchema = Joi.string().max(MAX_FIELD_NAME_LENGTH);
const fieldValueSchema = Joi.alternatives().try(
  Joi.boolean(),
  Joi.number(),
  Joi.string().max(MAX_FIELD_VALUE_LENGTH),
);

const getManySchema = Joi.object({
  dataset: Joi.string()
    .equal(...Object.values(Dataset))
    .required(),
  setId: CommonJoi.uid(false),
  subSet: Joi.string()
    .equal(...Object.values(Subset))
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
    body.subset && body.setId ? `${body.dataset}/${body.setId}/${body.subset}` : body.dataset;
  let query = build5Db()
    .collection(baseCollectionPath as COL)
    .limit(getQueryLimit(body.dataset));

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

  if (body.dataset === Dataset.NFT) {
    query = query.where('hidden', '==', false);
  }

  if (body.dataset === Dataset.TRANSACTION) {
    query = query.where('isOrderType', '==', false);
  }

  if (shouldSetProjectFilter(body.dataset, body.subset)) {
    query = query.where('project', '==', project);
  }

  if (body.startAfter) {
    const startAfter = getSnapshot(
      body.dataset,
      body.setId || body.startAfter,
      body.subset,
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
