import { BaseRecord, IDocument, IQuery, Update, database } from '@buildcore/database';
import {
  COL,
  Dataset,
  GetManyRequest,
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_VALUE_LENGTH,
  SUB_COL,
  Subset,
  WenError,
} from '@buildcore/interfaces';
import Joi from 'joi';
import { get, isEmpty } from 'lodash';
import { map } from 'rxjs';
import {
  CommonJoi,
  getQueryLimit,
  getQueryParams,
  keyToPg,
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
  setId: CommonJoi.uid(false, 5),
  subset: Joi.string()
    .equal(...Object.values(Subset))
    .optional(),
  fieldName: Joi.alternatives().try(fieldNameSchema, Joi.array().items(fieldNameSchema)).optional(),
  fieldValue: Joi.alternatives().conditional('fieldName', {
    is: fieldValueSchema.required(),
    then: fieldValueSchema.required(),
    otherwise: Joi.array().when('fieldName', {
      is: Joi.array().min(1).required(),
      then: Joi.array()
        .min(1)
        .length(Joi.ref('fieldName.length'))
        .items(fieldValueSchema)
        .required(),
      otherwise: Joi.forbidden(),
    }),
  }),
  startAfter: CommonJoi.uid(false),
});

export const getMany = async (project: string, url: string, isLive: boolean) => {
  const body = getQueryParams<GetManyRequest>(url, getManySchema);

  let query = database()
    .collection(body.dataset as unknown as COL, body.setId, body.subset as unknown as SUB_COL)!
    .limit(getQueryLimit(body.dataset)) as unknown as IQuery<any, BaseRecord>;

  if (body.fieldName && body.fieldValue != null) {
    try {
      const filters = getFilters(body.fieldName, body.fieldValue);
      Object.entries(filters).forEach(([key, value]) => {
        // TODO remove once everyone uses new SDK
        if (key === 'parentCol') {
          return;
        }
        const hasMany = value.length > 1;
        if (hasMany) {
          query = query.whereIn(keyToPg(key), value);
          return;
        }
        query = query.where(keyToPg(key), '==', value[0]);
      });
    } catch (error) {
      throw { code: 400, message: get(error, 'details.key', 'unknown') };
    }
  }

  if (body.dataset === Dataset.NFT) {
    query = query.where('hidden' as any, '==', false);
  }

  if (body.dataset === Dataset.TRANSACTION) {
    query = query.where('isOrderType' as any, '==', false);
  }

  if (shouldSetProjectFilter(body.dataset, body.subset)) {
    query = query.where('project', '==', project);
  }

  if (body.startAfter) {
    const docRef = database().doc(
      body.dataset as unknown as COL,
      body.setId || body.startAfter,
      body.subset as unknown as SUB_COL,
      body.startAfter,
    )! as unknown as IDocument<any, BaseRecord, Update>;
    const startAfter = await docRef.get();
    if (startAfter) {
      query = query.startAfter(startAfter);
    }
  }

  const observable = queryToObservable(query, isLive).pipe(
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
