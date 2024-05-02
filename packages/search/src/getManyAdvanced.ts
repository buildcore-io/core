import {
  BaseRecord,
  ICollection,
  IDocument,
  Update,
  WhereFilterOp,
  build5Db,
} from '@build-5/database';
import {
  COL,
  Dataset,
  GetManyAdvancedRequest,
  MAX_FIELD_NAME_LENGTH,
  MAX_FIELD_VALUE_LENGTH,
  Opr,
  QUERY_MAX_LENGTH,
  SUB_COL,
  Subset,
  TransactionType,
  WenError,
} from '@build-5/interfaces';
import Joi from 'joi';
import { get, isEmpty, isEqual } from 'lodash';
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
  Joi.date(),
  Joi.boolean(),
  Joi.number(),
  Joi.string().max(MAX_FIELD_VALUE_LENGTH),
);

const operatorSchema = Joi.string().equal(...Object.values(Opr));

const getManyAdvancedSchema = Joi.object({
  dataset: Joi.string()
    .equal(...Object.values(Dataset))
    .required(),
  setId: CommonJoi.uid(false, 5),
  subset: Joi.string()
    .equal(...Object.values(Subset))
    .optional(),
  fieldName: Joi.array().items(fieldNameSchema).optional(),
  fieldValue: Joi.array().length(Joi.ref('fieldName.length')).items(fieldValueSchema).optional(),
  operator: Joi.array().length(Joi.ref('fieldName.length')).items(operatorSchema).optional(),

  orderBy: Joi.array().min(1).items(fieldNameSchema).optional(),
  orderByDir: Joi.array().min(1).items(Joi.string().valid('asc', 'desc')).optional(),

  limit: Joi.number().min(1).max(QUERY_MAX_LENGTH).optional(),

  startAfter: CommonJoi.uid(false),
});

export const getManyAdvanced = async (project: string, url: string, isLive: boolean) => {
  const body = getQueryParams<GetManyAdvancedRequest>(url, getManyAdvancedSchema);

  const { dataset, subset, setId } = body;
  let query = getBaseQuery(dataset, setId, subset).limit(getQueryLimit(dataset));

  const { filters, operators } = getFilters(body.fieldName, body.fieldValue, body.operator);
  try {
    for (const [key, values] of Object.entries(filters)) {
      if (operators[key][0] === Opr.IN) {
        query = query.whereIn(keyToPg(key), values);
        continue;
      }
      for (let i = 0; i < values.length; ++i) {
        query = query.where(keyToPg(key), operators[key][i] as WhereFilterOp, values[i]);
      }
    }
  } catch (error) {
    throw { code: 400, message: get(error, 'details.key', 'unknown') };
  }

  if (body.dataset === Dataset.NFT && !isEqual(filters['hidden'], [false])) {
    query = query.where('hidden' as any, '==', false);
  }

  if (shouldSetProjectFilter(body.dataset, body.subset)) {
    query = query.where('project' as any, '==', project);
  }

  const typeFilters = filters['type'];
  if (
    body.dataset === Dataset.TRANSACTION &&
    (!typeFilters || typeFilters.includes(TransactionType.ORDER))
  ) {
    query = query.where('isOrderType' as any, '==', false);
  }

  const orderByDir = (body.orderByDir || []) as ('asc' | 'desc')[];
  for (let i = 0; i < (body.orderBy?.length || 0); ++i) {
    query = query.orderBy(keyToPg(body.orderBy![i]), orderByDir[i]);
  }

  if (body.limit) {
    query = query.limit(body.limit);
  }

  if (body.startAfter) {
    const docRef = build5Db().doc(
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

  return queryToObservable(query, isLive).pipe(
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

const getBaseQuery = (dataset: Dataset, setId?: string, subset?: Subset) =>
  build5Db().collection(
    dataset as unknown as COL,
    setId,
    subset as unknown as SUB_COL,
  )! as unknown as ICollection<any, BaseRecord, Update>;
