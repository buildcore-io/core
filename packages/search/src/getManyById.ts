import { build5Db } from '@build-5/database';
import { Dataset, GetManyByIdRequest, QUERY_MAX_LENGTH, Subset } from '@build-5/interfaces';
import Joi from 'joi';
import { combineLatest, map } from 'rxjs';
import {
  CommonJoi,
  documentToObservable,
  getQueryParams,
  isHiddenNft,
  maxAddressLength,
} from './common';

const uidSchema = Joi.string().alphanum().min(5).max(maxAddressLength).required();

const getManyByIdSchema = Joi.object({
  dataset: Joi.string()
    .equal(...Object.values(Dataset))
    .required(),
  setIds: Joi.array().items(CommonJoi.uid(false, 5)).max(QUERY_MAX_LENGTH).required(),
  subset: Joi.string()
    .equal(...Object.values(Subset))
    .optional(),
  subsetIds: Joi.array().items(uidSchema).min(1).max(QUERY_MAX_LENGTH).optional(),
});

export const getManyById = async (url: string) => {
  const body = getQueryParams<GetManyByIdRequest>(url, getManyByIdSchema);

  const observables = getQueries(body).map(documentToObservable<Record<string, unknown>>);
  return combineLatest(observables).pipe(
    map((all) => all.flat().filter((record) => record && !isHiddenNft(body.dataset, record))),
  );
};

const getQueries = (body: GetManyByIdRequest) =>
  body.setIds.map((setId, i) => {
    if (body.subset && body.subsetIds?.[i]) {
      return build5Db()
        .collection(body.dataset)
        .doc(setId)
        .collection(body.subset)
        .doc(body.subsetIds[i]);
    }
    return build5Db().doc(`${body.dataset}/${setId}`);
  });
